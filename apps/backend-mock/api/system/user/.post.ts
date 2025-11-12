import { eventHandler, readBody } from 'h3';
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

    // Hash password nếu có
    let hashedPassword: string | undefined;
    if (body.password) {
      // Nếu password chưa được hash, hash nó
      if (!isPasswordHashed(body.password)) {
        hashedPassword = await hashPassword(body.password);
      } else {
        hashedPassword = body.password; // Đã hash rồi
      }
    }

    // Convert roles to role if provided (for backward compatibility)
    let userRole: 0 | 1 = 1; // Default to user
    if (body.role !== undefined && body.role !== null) {
      userRole = body.role === 0 ? 0 : 1;
    } else if (body.roles && Array.isArray(body.roles)) {
      // Migrate from old format
      userRole = body.roles.some((r: string) => r === 'admin' || r === 'super') ? 0 : 1;
    }

    // Tạo user mới
    const newUser: any = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      username: body.username,
      realName: body.realName || '',
      email: body.email || '',
      phone: body.phone || '',
      role: userRole, // Use role (0 or 1) instead of roles (array)
      status: body.status !== undefined ? body.status : 1,
      createTime: new Date().toISOString(),
      remark: body.remark || '',
    };
    
    // Chỉ thêm password nếu có
    if (hashedPassword) {
      newUser.password = hashedPassword;
    }

    const result = await usersCollection.insertOne(newUser);

    if (!result.insertedId) {
      return useResponseError('Failed to create user');
    }

    // Lấy user vừa tạo
    const createdUser = await usersCollection.findOne({ _id: result.insertedId });
    const { _id, password: _pwd, ...userData } = createdUser!;

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

