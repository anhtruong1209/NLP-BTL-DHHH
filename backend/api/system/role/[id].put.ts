import { eventHandler, getRouterParam, readBody } from 'h3';
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

  const id = getRouterParam(event, 'id');
  if (!id) {
    return useResponseError('Role ID is required');
  }

  try {
    const body = await readBody(event);
    const rolesCollection = await getRolesCollection();

    // Check if role exists
    const existingRole = await rolesCollection.findOne({ id });
    if (!existingRole) {
      return useResponseError('Role not found');
    }

    // Check code uniqueness (if changed)
    if (body.code && body.code !== existingRole.code) {
      const duplicateRole = await rolesCollection.findOne({
        code: body.code,
        id: { $ne: id },
      });
      if (duplicateRole) {
        return useResponseError('Role code already exists');
      }
    }

    // Update role (exclude id from body)
    const { id: _, ...updateData } = body;
    updateData.updateTime = new Date().toISOString();
    
    const result = await rolesCollection.updateOne(
      { id },
      { $set: updateData },
    );

    if (result.matchedCount === 0) {
      return useResponseError('Role not found');
    }

    // Get updated role
    const updatedRole = await rolesCollection.findOne({ id });
    const { _id, ...roleData } = updatedRole!;

    return useResponseSuccess({
      ...roleData,
      id: roleData.id || _id?.toString(),
    });
  } catch (error) {
    console.error('Error updating role:', error);
    return useResponseError(
      error instanceof Error ? error.message : 'Failed to update role',
    );
  }
});

