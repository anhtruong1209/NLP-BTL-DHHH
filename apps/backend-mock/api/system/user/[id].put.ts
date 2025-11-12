import { eventHandler, getRouterParam, readBody } from 'h3';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { getUsersCollection } from '~/utils/mongodb';
import { hashPassword, isPasswordHashed } from '~/utils/password-utils';
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
    const { id: _, password, roles, ...updateData } = body;
    
    // Handle role code - convert to string for consistency
    if (body.role !== undefined && body.role !== null) {
      // Role code can be string or number, convert to string
      (updateData as any).role = String(body.role);
      // Remove old roles field if exists
      (updateData as any).$unset = { roles: '' };
    } else if (roles && Array.isArray(roles)) {
      // Migrate from old format - use first role code if available
      (updateData as any).role = roles[0] || '1';
      (updateData as any).$unset = { roles: '' };
    }
    
    // Hash password nếu có thay đổi
    if (password) {
      // Nếu password chưa được hash, hash nó
      if (!isPasswordHashed(password)) {
        (updateData as any).password = await hashPassword(password);
      } else {
        (updateData as any).password = password; // Đã hash rồi
      }
    }
    
    // Handle $unset separately if needed
    const unsetData: any = {};
    if ((updateData as any).$unset) {
      Object.assign(unsetData, (updateData as any).$unset);
      delete (updateData as any).$unset;
    }
    
    const updateOp: any = { $set: updateData };
    if (Object.keys(unsetData).length > 0) {
      updateOp.$unset = unsetData;
    }
    
    const result = await usersCollection.updateOne(
      { id },
      updateOp,
    );

    if (result.matchedCount === 0) {
      return useResponseError('User not found');
    }

    // Lấy user đã cập nhật
    const updatedUser = await usersCollection.findOne({ id });
    const { _id, password: _pwd, ...userData } = updatedUser!;

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

