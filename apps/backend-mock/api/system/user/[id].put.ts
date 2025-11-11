import { eventHandler, getRouterParam, readBody } from 'h3';
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

  const id = getRouterParam(event, 'id');
  if (!id) {
    return useResponseError('User ID is required');
  }

  try {
    const body = await readBody(event);
    const usersCollection = await getUsersCollection();

    // Kiểm tra user có tồn tại không
    const existingUser = await usersCollection.findOne({ id });
    if (!existingUser) {
      return useResponseError('User not found');
    }

    // Kiểm tra username trùng lặp (nếu có thay đổi)
    if (body.username && body.username !== existingUser.username) {
      const duplicateUser = await usersCollection.findOne({
        username: body.username,
        id: { $ne: id },
      });
      if (duplicateUser) {
        return useResponseError('Username already exists');
      }
    }

    // Kiểm tra email trùng lặp (nếu có thay đổi)
    if (body.email && body.email !== existingUser.email) {
      const duplicateEmail = await usersCollection.findOne({
        email: body.email,
        id: { $ne: id },
      });
      if (duplicateEmail) {
        return useResponseError('Email already exists');
      }
    }

    // Cập nhật user (loại bỏ id khỏi body để không cập nhật)
    const { id: _, ...updateData } = body;
    
    const result = await usersCollection.updateOne(
      { id },
      { $set: updateData },
    );

    if (result.matchedCount === 0) {
      return useResponseError('User not found');
    }

    // Lấy user đã cập nhật
    const updatedUser = await usersCollection.findOne({ id });
    const { _id, ...userData } = updatedUser!;

    return useResponseSuccess({
      ...userData,
      id: userData.id || _id?.toString(),
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return useResponseError(
      error instanceof Error ? error.message : 'Failed to update user',
    );
  }
});

