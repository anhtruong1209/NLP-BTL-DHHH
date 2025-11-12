import { defineEventHandler, getRouterParam, readBody } from 'h3';
import { getChatSessionsCollection } from '~/utils/mongodb';

export default defineEventHandler(async (event) => {
	const sessionId = getRouterParam(event, 'sessionId');
	if (!sessionId) {
		event.node.res.statusCode = 400;
		return { error: 'sessionId is required' };
	}

	const body = (await readBody(event)) as { pinned?: boolean };
	const pinned = body.pinned ?? true;

	const col = await getChatSessionsCollection();
	const result = await col.updateOne(
		{ sessionId },
		{ $set: { pinned } },
	);

	if (result.matchedCount === 0) {
		event.node.res.statusCode = 404;
		return { error: 'Session not found' };
	}

	return { ok: true, pinned };
});

