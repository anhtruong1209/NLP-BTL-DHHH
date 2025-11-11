import { eventHandler, readBody } from 'h3';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { getUsersCollection } from '~/utils/mongodb';
import {
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const body = await readBody(event);
    const usersCollection = await getUsersCollection();

    // Kiểm tra username trùng lặp
    if (body.username) {
      const existingUser = await usersCollection.findOne({
        username: body.username,
      });
      if (existingUser) {
        return useResponseError('Username already exists');
      }
    }

    // Kiểm tra email trùng lặp
    if (body.email) {
      const existingEmail = await usersCollection.findOne({
        email: body.email,
      });
      if (existingEmail) {
        return useResponseError('Email already exists');
      }
    }

    // Tạo user mới
    const newUser = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      username: body.username,
      realName: body.realName || '',
      email: body.email || '',
      phone: body.phone || '',
      roles: body.roles || ['user'],
      status: body.status !== undefined ? body.status : 1,
      createTime: new Date().toISOString(),
      remark: body.remark || '',
    };

    const result = await usersCollection.insertOne(newUser);

    if (!result.insertedId) {
      return useResponseError('Failed to create user');
    }

    // Lấy user vừa tạo
    const createdUser = await usersCollection.findOne({ _id: result.insertedId });
    const { _id, ...userData } = createdUser!;

    return useResponseSuccess({
      ...userData,
      id: userData.id || _id?.toString(),
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return useResponseError(
      error instanceof Error ? error.message : 'Failed to create user',
    );
  }
});

