import { defineEventHandler, readBody } from 'h3';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { getUsersCollection } from '~/utils/mongodb';
import { hashPassword } from '~/utils/password-utils';
import {
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

/**
 * Reset password for a user (admin only)
 * Useful for fixing password hash issues
 */
export default defineEventHandler(async (event) => {
  const userinfo = verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  // Check if admin
  const isAdmin = userinfo.roles?.some(r => r === 'admin' || r === 'super');
  if (!isAdmin) {
    event.node.res.statusCode = 403;
    return useResponseError('Forbidden: Admin access required');
  }

  try {
    const body = await readBody(event);
    const { username, newPassword } = body;

    if (!username || !newPassword) {
      return useResponseError('Username and newPassword are required');
    }

    const usersCollection = await getUsersCollection();
    const user = await usersCollection.findOne({ username });

    if (!user) {
      return useResponseError('User not found');
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    await usersCollection.updateOne(
      { username },
      { $set: { password: hashedPassword } }
    );

    return useResponseSuccess({
      message: 'Password reset successfully',
      username,
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    return useResponseError(
      error instanceof Error ? error.message : 'Failed to reset password',
    );
  }
});

