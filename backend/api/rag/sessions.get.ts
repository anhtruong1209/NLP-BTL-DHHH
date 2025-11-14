import { defineEventHandler, getQuery } from 'h3';
import { getChatSessionsCollection } from '../../utils/mongodb';

export default defineEventHandler(async (event) => {
	const query = getQuery(event) as { userId?: string };
	const userId = (query.userId ?? '').toString().trim();
	const col = await getChatSessionsCollection();
	// Query with both string and number to handle type inconsistencies
	const filter = userId ? { 
		$or: [
			{ userId: userId },
			{ userId: Number(userId) || userId }
		]
	} : {};
	const sessions = await col.find(filter).sort({ updatedAt: -1 }).limit(200).toArray();
	console.log('[RAG][sessions] query:', { userId, filter, count: sessions.length });
	return { ok: true, sessions };
});


