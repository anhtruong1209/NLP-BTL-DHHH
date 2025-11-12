import { H3Event } from 'h3';
import { verifyAccessToken } from './jwt-utils';
import type { UserRole } from './mongodb';

/**
 * User role constants
 */
export const USER_ROLE = {
  ADMIN: 0 as const,
  USER: 1 as const,
} as const;

/**
 * Get user info from JWT token in request headers
 */
export async function getUserFromRequest(event: H3Event) {
  return await verifyAccessToken(event);
}

/**
 * Check if user has admin role (role === 0)
 */
export function isAdmin(role?: UserRole | number | null): boolean {
  return role === USER_ROLE.ADMIN;
}

/**
 * Check if user has required role
 */
export function hasRole(userRole: UserRole | number | null | undefined, requiredRole: UserRole): boolean {
  if (userRole === null || userRole === undefined) return false;
  return userRole === requiredRole;
}

/**
 * Require admin role - returns 403 if not admin
 */
export async function requireAdmin(event: H3Event): Promise<void> {
  const userinfo = await getUserFromRequest(event);
  console.log('[Auth] requireAdmin check:', {
    hasUserinfo: !!userinfo,
    username: userinfo?.username,
    role: userinfo?.role,
    isAdmin: isAdmin(userinfo?.role),
  });
  
  if (!userinfo) {
    event.node.res.statusCode = 401;
    throw new Error('Unauthorized: Please login');
  }
  
  if (!isAdmin(userinfo.role)) {
    event.node.res.statusCode = 403;
    throw new Error('Forbidden: Admin access required');
  }
}

