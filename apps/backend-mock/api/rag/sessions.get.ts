import { defineEventHandler, getQuery } from 'h3';
import { getChatSessionsCollection } from '~/utils/mongodb';

export default defineEventHandler(async (event) => {
	const query = getQuery(event) as { userId?: string };
	const userId = (query.userId ?? '').toString().trim();
	const col = await getChatSessionsCollection();
	const filter = userId ? { userId } : {};
	const sessions = await col.find(filter).sort({ updatedAt: -1 }).limit(200).toArray();
	return { ok: true, sessions };
});


