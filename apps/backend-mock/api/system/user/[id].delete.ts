import { eventHandler, getRouterParam } from 'h3';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { getUsersCollection } from '~/utils/mongodb';
import {
  forbiddenResponse,
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
    const usersCollection = await getUsersCollection();
    
    // Kiểm tra user có tồn tại không
    const user = await usersCollection.findOne({ id });
    if (!user) {
      return useResponseError('User not found');
    }

    // Không cho phép xóa user mặc định
    if (user.username === 'admin' || user.username === 'user') {
      return forbiddenResponse(event, 'Cannot delete default users');
    }

    // Xóa user
    const result = await usersCollection.deleteOne({ id });
    
    if (result.deletedCount === 0) {
      return useResponseError('Failed to delete user');
    }

    return useResponseSuccess(null);
  } catch (error) {
    console.error('Error deleting user:', error);
    return useResponseError(
      error instanceof Error ? error.message : 'Failed to delete user',
    );
  }
});

