import { defineEventHandler, getQuery } from 'h3';
import { 
	getChatSessionsCollection, 
	getChatMessagesCollection, 
	getModelUsageCollection,
	getUsersCollection 
} from '~/utils/mongodb';
import { getUserFromRequest, isAdmin } from '~/utils/auth-utils';
import { useResponseSuccess, useResponseError } from '~/utils/response';

export default defineEventHandler(async (event) => {
	const userinfo = await getUserFromRequest(event);
	if (!userinfo) {
		event.node.res.statusCode = 401;
		return useResponseError('Unauthorized');
	}

	const isUserAdmin = isAdmin(userinfo.roles);
	const query = getQuery(event) as { userId?: string; days?: string };
	const days = Math.max(1, Math.min(365, Number(query.days ?? '30') || 30));
	const targetUserId = query.userId?.trim();

	// If not admin, only show own stats
	// userinfo.id might be number, convert to string
	const currentUserId = userinfo.id ? String(userinfo.id) : undefined;
	const userId = isUserAdmin && targetUserId ? targetUserId : currentUserId;

	const since = new Date();
	since.setDate(since.getDate() - days);

	const sessionsCol = await getChatSessionsCollection();
	const messagesCol = await getChatMessagesCollection();
	const usageCol = await getModelUsageCollection();
	const usersCol = await getUsersCollection();

	// Build filter
	const sessionFilter: any = { createdAt: { $gte: since.toISOString() } };
	const messageFilter: any = { createdAt: { $gte: since.toISOString() } };
	const usageFilter: any = { timestamp: { $gte: since.toISOString() } };

	if (userId) {
		sessionFilter.userId = userId;
		usageFilter.userId = userId;
	}

	// Total sessions
	const totalSessions = await sessionsCol.countDocuments(sessionFilter);

	// Total messages
	const totalMessages = await messagesCol.countDocuments(messageFilter);

	// Total users (admin only)
	let totalUsers = 0;
	if (isUserAdmin) {
		totalUsers = await usersCol.countDocuments({ status: 1 });
	}

	// Model usage stats
	const modelUsage = await usageCol.aggregate([
		{ $match: usageFilter },
		{
			$group: {
				_id: '$modelKey',
				count: { $sum: 1 },
				avgResponseTime: { $avg: '$responseTime' },
			},
		},
		{ $sort: { count: -1 } },
	]).toArray();

	// Daily stats for sessions (last N days)
	const dailyStats = await sessionsCol.aggregate([
		{ $match: sessionFilter },
		{
			$group: {
				_id: { $dateToString: { format: '%Y-%m-%d', date: { $toDate: '$createdAt' } } },
				count: { $sum: 1 },
			},
		},
		{ $sort: { _id: 1 } },
	]).toArray();

	// Daily stats for messages
	const messagesDailyStats = await messagesCol.aggregate([
		{ $match: messageFilter },
		{
			$group: {
				_id: { $dateToString: { format: '%Y-%m-%d', date: { $toDate: '$createdAt' } } },
				count: { $sum: 1 },
			},
		},
		{ $sort: { _id: 1 } },
	]).toArray();

	// Hourly stats (last 24 hours)
	const last24Hours = new Date();
	last24Hours.setHours(last24Hours.getHours() - 24);
	const hourlyStats = await messagesCol.aggregate([
		{ 
			$match: { 
				...messageFilter,
				createdAt: { $gte: last24Hours.toISOString() }
			} 
		},
		{
			$group: {
				_id: { $dateToString: { format: '%Y-%m-%d %H:00', date: { $toDate: '$createdAt' } } },
				count: { $sum: 1 },
			},
		},
		{ $sort: { _id: 1 } },
	]).toArray();

	// Average response time per day
	const avgResponseTimeDaily = await usageCol.aggregate([
		{ $match: usageFilter },
		{
			$group: {
				_id: { $dateToString: { format: '%Y-%m-%d', date: { $toDate: '$timestamp' } } },
				avgResponseTime: { $avg: '$responseTime' },
				count: { $sum: 1 },
			},
		},
		{ $sort: { _id: 1 } },
	]).toArray();

	// User stats (admin only)
	let userStats: any[] = [];
	if (isUserAdmin) {
		userStats = await sessionsCol.aggregate([
			{ $match: { createdAt: { $gte: since.toISOString() } } },
			{
				$group: {
					_id: '$userId',
					sessionCount: { $sum: 1 },
				},
			},
			{ $sort: { sessionCount: -1 } },
			{ $limit: 10 },
		]).toArray();
	}

	// Top conversations by message count
	const topConversations = await messagesCol.aggregate([
		{ $match: messageFilter },
		{
			$group: {
				_id: '$sessionId',
				messageCount: { $sum: 1 },
				lastMessage: { $max: '$createdAt' },
			},
		},
		{ $sort: { messageCount: -1 } },
		{ $limit: 10 },
	]).toArray();

	// Get session titles for top conversations
	const topSessionIds = topConversations.map(c => c._id);
	const topSessions = await sessionsCol.find({ 
		sessionId: { $in: topSessionIds } 
	}).toArray();
	const sessionMap = new Map(topSessions.map(s => [s.sessionId, s]));

	return useResponseSuccess({
		stats: {
			totalSessions,
			totalMessages,
			totalUsers: isUserAdmin ? totalUsers : undefined,
			modelUsage: modelUsage.map(m => ({
				modelKey: m._id,
				count: m.count,
				avgResponseTime: Math.round(m.avgResponseTime || 0),
			})),
			dailyStats: dailyStats.map(d => ({
				date: d._id,
				count: d.count,
			})),
			messagesDailyStats: messagesDailyStats.map(d => ({
				date: d._id,
				count: d.count,
			})),
			hourlyStats: hourlyStats.map(h => ({
				hour: h._id,
				count: h.count,
			})),
			avgResponseTimeDaily: avgResponseTimeDaily.map(d => ({
				date: d._id,
				avgResponseTime: Math.round(d.avgResponseTime || 0),
				count: d.count,
			})),
			topConversations: topConversations.map(c => {
				const session = sessionMap.get(c._id);
				return {
					sessionId: c._id,
					title: session?.title || 'Untitled',
					messageCount: c.messageCount,
					lastMessage: c.lastMessage,
				};
			}),
			userStats: isUserAdmin ? userStats.map(u => ({
				userId: u._id,
				sessionCount: u.sessionCount,
			})) : undefined,
		},
	});
});

