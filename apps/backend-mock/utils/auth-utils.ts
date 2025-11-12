import { H3Event } from 'h3';
import { verifyAccessToken } from './jwt-utils';

/**
 * Get user info from JWT token in request headers
 */
export async function getUserFromRequest(event: H3Event) {
  return await verifyAccessToken(event);
}

/**
 * Check if user has admin role
 */
export function isAdmin(roles?: string[]): boolean {
  if (!roles || roles.length === 0) return false;
  return roles.some(role => role === 'admin' || role === 'super');
}

/**
 * Check if user has required role
 */
export function hasRole(roles: string[], requiredRoles: string[]): boolean {
  if (!roles || roles.length === 0) return false;
  return requiredRoles.some(role => roles.includes(role));
}

/**
 * Require admin role - returns 403 if not admin
 */
export async function requireAdmin(event: H3Event): Promise<void> {
  const userinfo = await getUserFromRequest(event);
  console.log('[Auth] requireAdmin check:', {
    hasUserinfo: !!userinfo,
    username: userinfo?.username,
    roles: userinfo?.roles,
    isAdmin: isAdmin(userinfo?.roles),
  });
  
  if (!userinfo) {
    event.node.res.statusCode = 401;
    throw new Error('Unauthorized: Please login');
  }
  
  if (!isAdmin(userinfo.roles)) {
    event.node.res.statusCode = 403;
    throw new Error('Forbidden: Admin access required');
  }
}

