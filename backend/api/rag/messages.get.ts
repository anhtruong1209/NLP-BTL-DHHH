import { defineEventHandler, getQuery } from 'h3';

import {
	getChatMessagesCollection,
	getChatSessionsCollection,
} from '../../utils/mongodb';
import { verifyAccessToken } from '../../utils/jwt-utils';

export default defineEventHandler(async (event) => {
	const userinfo = await verifyAccessToken(event);
	if (!userinfo) {
		event.node.res.statusCode = 401;
		return { ok: false, error: 'Unauthorized' };
	}

	const query = getQuery(event) as { sessionId?: string; limit?: string };
	const sessionId = (query.sessionId ?? '').toString().trim();
	if (!sessionId) {
		event.node.res.statusCode = 400;
		return { ok: false, error: 'sessionId is required' };
	}

	const limitParam = Number(query.limit);
	const limit = Number.isFinite(limitParam)
		? Math.min(1000, Math.max(1, limitParam))
		: 500;

	const sessionsCol = await getChatSessionsCollection();
	const session = await sessionsCol.findOne({ sessionId });
	if (!session) {
		event.node.res.statusCode = 404;
		return { ok: false, error: 'Session not found' };
	}

	const authUserId = String(userinfo.id ?? userinfo.username ?? '');
	const isAdmin = (userinfo as any)?.role === 0;
	if (!isAdmin && session.userId && String(session.userId) !== authUserId) {
		event.node.res.statusCode = 403;
		return { ok: false, error: 'Forbidden: Session does not belong to user' };
	}

	const messagesCol = await getChatMessagesCollection();
	const docs = await messagesCol
		.find({ sessionId })
		.sort({ createdAt: 1 })
		.limit(limit)
		.toArray();

	return {
		ok: true,
		messages: docs.map(({ _id, ...msg }) => ({
			...msg,
			_id: _id?.toString?.() ?? _id,
		})),
	};
});


