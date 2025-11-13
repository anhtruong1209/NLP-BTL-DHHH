import type { EventHandlerRequest, H3Event } from 'h3';

import type { UserInfo } from './mock-data';

import { getHeader } from 'h3';
import jwt from 'jsonwebtoken';

import { MOCK_USERS } from './mock-data';
import { getUsersCollection } from './mongodb';

// JWT secrets from environment variables, with fallback for development
const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_TOKEN_SECRET || 'access_token_secret_change_in_production';
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_TOKEN_SECRET || 'refresh_token_secret_change_in_production';

export interface UserPayload extends UserInfo {
  iat: number;
  exp: number;
}

export function generateAccessToken(user: UserInfo) {
  return jwt.sign(user, ACCESS_TOKEN_SECRET, { expiresIn: '7d' });
}

export function generateRefreshToken(user: UserInfo) {
  return jwt.sign(user, REFRESH_TOKEN_SECRET, {
    expiresIn: '30d',
  });
}

export async function verifyAccessToken(
  event: H3Event<EventHandlerRequest>,
): Promise<null | Omit<UserInfo, 'password'>> {
  const authHeader = getHeader(event, 'Authorization');
  if (!authHeader?.startsWith('Bearer')) {
    return null;
  }

  const tokenParts = authHeader.split(' ');
  if (tokenParts.length !== 2) {
    return null;
  }
  const token = tokenParts[1] as string;
  try {
    const decoded = jwt.verify(
      token,
      ACCESS_TOKEN_SECRET,
    ) as unknown as UserPayload;

    const username = decoded.username;
    console.log('[JWT] Verifying token for user:', username);
    
    // Try to get user from MongoDB first
    try {
      const usersCollection = await getUsersCollection();
      const dbUser = await usersCollection.findOne({ username, status: 1 });
      if (dbUser) {
        // Migrate old roles format to new role format if needed
        let userRole: number;
        if (dbUser.role !== undefined && dbUser.role !== null) {
          userRole = dbUser.role;
        } else if (dbUser.roles && Array.isArray(dbUser.roles)) {
          // Migrate from old format
          userRole = dbUser.roles.some((r: string) => r === 'admin' || r === 'super') ? 0 : 1;
        } else {
          userRole = 1; // Default to user
        }
        
        console.log('[JWT] Found user in MongoDB:', {
          username: dbUser.username,
          role: userRole,
          id: dbUser.id,
        });
        const { password: _pwd, ...userinfo } = dbUser;
        return {
          id: Number(dbUser.id.replace(/\D/g, '')) || 0,
          username: dbUser.username,
          realName: dbUser.realName,
          role: userRole, // Return role as number
          homePath: dbUser.homePath,
        } as any; // Type assertion for compatibility
      } else {
        console.warn('[JWT] User not found in MongoDB:', username);
      }
    } catch (dbError) {
      console.warn('[JWT] MongoDB lookup failed, falling back to MOCK_USERS:', dbError);
    }
    
    // Fallback to MOCK_USERS (migrate old format)
    const user = MOCK_USERS.find((item) => item.username === username);
    if (!user) {
      return null;
    }
    const { password: _pwd, roles, ...userinfo } = user;
    // Migrate roles to role
    const userRole = roles?.some((r: string) => r === 'admin' || r === 'super') ? 0 : 1;
    return {
      ...userinfo,
      role: userRole,
    } as any;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(
  token: string,
): null | Omit<UserInfo, 'password'> {
  try {
    const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET) as UserPayload;
    const username = decoded.username;
    const user = MOCK_USERS.find(
      (item) => item.username === username,
    ) as UserInfo;
    if (!user) {
      return null;
    }
    const { password: _pwd, ...userinfo } = user;
    return userinfo;
  } catch {
    return null;
  }
}
