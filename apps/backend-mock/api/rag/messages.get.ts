import { defineEventHandler, getQuery } from 'h3';
import { getChatMessagesCollection, getChatSessionsCollection } from '~/utils/mongodb';

export default defineEventHandler(async (event) => {
	const query = getQuery(event) as { sessionId?: string; limit?: string; userId?: string };
	const sessionId = (query.sessionId ?? '').toString().trim();
	if (!sessionId) {
		event.node.res.statusCode = 400;
		return { error: 'sessionId is required' };
	}
	const userId = (query.userId ?? '').toString().trim();
	// If userId provided, verify session belongs to the user
	if (userId) {
		const sessionsCol = await getChatSessionsCollection();
		const session = await sessionsCol.findOne({ sessionId });
		// Normalize both userIds to string for comparison
		const sessionUserId = session?.userId ? String(session.userId).trim() : '';
		const normalizedUserId = userId.trim();
		console.log('[RAG][messages] checking access:', { sessionId, sessionUserId, normalizedUserId, match: sessionUserId === normalizedUserId });
		if (!session || sessionUserId !== normalizedUserId) {
			event.node.res.statusCode = 403;
			return { error: 'Forbidden: session does not belong to user' };
		}
	}
	const limit = Math.max(1, Math.min(500, Number(query.limit ?? '200') || 200));
	const col = await getChatMessagesCollection();
	const messages = await col.find({ sessionId }).sort({ createdAt: 1 }).limit(limit).toArray();
	return { ok: true, sessionId, messages };
});


