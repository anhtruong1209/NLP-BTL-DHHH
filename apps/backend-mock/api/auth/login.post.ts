import { defineEventHandler, readBody, setResponseStatus } from 'h3';
import {
  clearRefreshTokenCookie,
  setRefreshTokenCookie,
} from '~/utils/cookie-utils';
import { generateAccessToken, generateRefreshToken } from '~/utils/jwt-utils';
import { getUsersCollection } from '~/utils/mongodb';
import {
  forbiddenResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

export default defineEventHandler(async (event) => {
  const { password, username } = await readBody(event);
  if (!password || !username) {
    setResponseStatus(event, 400);
    return useResponseError(
      'BadRequestException',
      'Username and password are required',
    );
  }

  try {
    console.log('🔐 Login attempt:', { username, passwordLength: password?.length });
    
    const usersCollection = await getUsersCollection();
    
    // Tìm user theo username trước
    const findUser = await usersCollection.findOne({
      username,
      status: 1, // Chỉ cho phép đăng nhập user đang active
    });

    console.log('👤 User found:', findUser ? 'Yes' : 'No');
    
    if (!findUser) {
      console.log('❌ User not found or inactive');
      clearRefreshTokenCookie(event);
      return forbiddenResponse(event, 'Username or password is incorrect.');
    }

    // Kiểm tra password
    if (findUser.password !== password) {
      console.log('❌ Password mismatch');
      clearRefreshTokenCookie(event);
      return forbiddenResponse(event, 'Username or password is incorrect.');
    }

    console.log('✅ Login successful for user:', username);

    // Chuyển đổi sang format UserInfo cho JWT
    const userInfo = {
      id: Number(findUser.id.replace(/\D/g, '')) || 0,
      username: findUser.username,
      realName: findUser.realName,
      roles: findUser.roles,
      homePath: findUser.homePath,
    };

    const accessToken = generateAccessToken(userInfo);
    const refreshToken = generateRefreshToken(userInfo);

    setRefreshTokenCookie(event, refreshToken);

    return useResponseSuccess({
      ...userInfo,
      accessToken,
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    console.error('Error details:', error instanceof Error ? error.message : error);
    clearRefreshTokenCookie(event);
    return forbiddenResponse(event, `Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});
