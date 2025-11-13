import { defineEventHandler, getRouterParam } from 'h3';
import { getChatSessionsCollection, getChatMessagesCollection } from '~/utils/mongodb';
import { getUserFromRequest } from '~/utils/auth-utils';

export default defineEventHandler(async (event) => {
	const sessionId = getRouterParam(event, 'sessionId');
	if (!sessionId) {
		event.node.res.statusCode = 400;
		return { error: 'sessionId is required' };
	}

	const userinfo = await getUserFromRequest(event);
	const userId = userinfo?.id ? String(userinfo.id) : undefined;

	const sessionsCol = await getChatSessionsCollection();
	const messagesCol = await getChatMessagesCollection();

	// Check if session exists and belongs to user (if userId provided)
	const session = await sessionsCol.findOne({ sessionId });
	if (!session) {
		event.node.res.statusCode = 404;
		return { error: 'Session not found' };
	}

	// If userId provided, verify ownership
	if (userId && session.userId) {
		const sessionUserId = String(session.userId);
		if (sessionUserId !== userId) {
			event.node.res.statusCode = 403;
			return { error: 'Forbidden: Session does not belong to user' };
		}
	}

	// Delete session and all its messages
	const [sessionResult, messagesResult] = await Promise.all([
		sessionsCol.deleteOne({ sessionId }),
		messagesCol.deleteMany({ sessionId }),
	]);

	if (sessionResult.deletedCount === 0) {
		event.node.res.statusCode = 404;
		return { error: 'Session not found' };
	}

	return {
		ok: true,
		message: 'Session deleted successfully',
		deletedMessages: messagesResult.deletedCount,
	};
});

