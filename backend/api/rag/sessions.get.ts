import { defineEventHandler, getQuery } from 'h3';

import { getChatSessionsCollection } from '../../utils/mongodb';
import { verifyAccessToken } from '../../utils/jwt-utils';

export default defineEventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    event.node.res.statusCode = 401;
    return { ok: false, error: 'Unauthorized', sessions: [] };
  }

  const query = getQuery(event) as { userId?: string };
  const requestedUserId = (query.userId ?? '').toString().trim();
  const authenticatedUserId = String(
    userinfo.id ?? userinfo.username ?? '',
  ).trim();

  if (!authenticatedUserId && !requestedUserId) {
    event.node.res.statusCode = 400;
    return { ok: false, error: 'User ID is required', sessions: [] };
  }

  const userRole = (userinfo as any)?.role;
  const isAdmin = userRole === 0;

  const sessionsCol = await getChatSessionsCollection();

  const filter: Record<string, any> = {};
  if (isAdmin) {
    if (requestedUserId) {
      filter.userId = requestedUserId;
    }
  } else {
    filter.userId = authenticatedUserId || requestedUserId;
  }

  const sessions = await sessionsCol
    .find(filter)
    .sort({ updatedAt: -1 })
    .limit(200)
    .toArray();

  console.log('[RAG][sessions] query:', {
    requestedUserId,
    authenticatedUserId,
    userRole,
    isAdmin,
    filter,
    count: sessions.length,
  });

  return {
    ok: true,
    sessions: sessions.map(({ _id, ...session }) => ({
      ...session,
      _id: _id?.toString?.() ?? _id,
    })),
  };
});


