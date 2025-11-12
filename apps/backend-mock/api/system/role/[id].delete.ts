import { eventHandler, getRouterParam } from 'h3';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { getRolesCollection, getUsersCollection } from '~/utils/mongodb';
import {
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const id = getRouterParam(event, 'id');
  if (!id) {
    return useResponseError('Role ID is required');
  }

  try {
    const rolesCollection = await getRolesCollection();
    const usersCollection = await getUsersCollection();

    // Check if role exists
    const role = await rolesCollection.findOne({ id });
    if (!role) {
      return useResponseError('Role not found');
    }

    // Check if any user is using this role
    const usersWithRole = await usersCollection.countDocuments({
      roles: role.code,
    });
    if (usersWithRole > 0) {
      return useResponseError(`Cannot delete role: ${usersWithRole} user(s) are using this role`);
    }

    // Delete role
    const result = await rolesCollection.deleteOne({ id });

    if (result.deletedCount === 0) {
      return useResponseError('Role not found');
    }

    return useResponseSuccess({ message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Error deleting role:', error);
    return useResponseError(
      error instanceof Error ? error.message : 'Failed to delete role',
    );
  }
});

