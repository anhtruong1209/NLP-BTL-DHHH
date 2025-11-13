import { defineEventHandler, getRouterParam, readBody } from 'h3';
import { getChatSessionsCollection } from '~/utils/mongodb';

export default defineEventHandler(async (event) => {
	const sessionId = getRouterParam(event, 'sessionId');
	if (!sessionId) {
		event.node.res.statusCode = 400;
		return { error: 'sessionId is required' };
	}

	const body = (await readBody(event)) as { title?: string };
	const title = body.title?.trim();
	
	if (!title) {
		event.node.res.statusCode = 400;
		return { error: 'title is required' };
	}

	const col = await getChatSessionsCollection();
	const result = await col.updateOne(
		{ sessionId },
		{ 
			$set: { 
				title: title.slice(0, 100), // Limit title length
				updatedAt: new Date().toISOString()
			} 
		},
	);

	if (result.matchedCount === 0) {
		event.node.res.statusCode = 404;
		return { error: 'Session not found' };
	}

	return { ok: true, title: title.slice(0, 100) };
});

