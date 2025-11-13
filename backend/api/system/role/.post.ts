import { eventHandler, readBody } from 'h3';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { getRolesCollection } from '~/utils/mongodb';
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

  try {
    const body = await readBody(event);
    const rolesCollection = await getRolesCollection();

    // Check code uniqueness
    if (body.code) {
      const existingRole = await rolesCollection.findOne({
        code: body.code,
      });
      if (existingRole) {
        return useResponseError('Role code already exists');
      }
    }

    // Create new role
    const newRole = {
      id: `role-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: body.name || '',
      code: body.code || '',
      status: body.status !== undefined ? body.status : 1,
      permissions: body.permissions || [],
      remark: body.remark || '',
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString(),
    };

    const result = await rolesCollection.insertOne(newRole);

    if (!result.insertedId) {
      return useResponseError('Failed to create role');
    }

    // Get created role
    const createdRole = await rolesCollection.findOne({ _id: result.insertedId });
    const { _id, ...roleData } = createdRole!;

    return useResponseSuccess({
      ...roleData,
      id: roleData.id || _id?.toString(),
    });
  } catch (error) {
    console.error('Error creating role:', error);
    return useResponseError(
      error instanceof Error ? error.message : 'Failed to create role',
    );
  }
});

