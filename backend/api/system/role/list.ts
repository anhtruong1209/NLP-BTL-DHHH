import { eventHandler, getQuery } from 'h3';
import { verifyAccessToken } from '../../../utils/jwt-utils';
import { getRolesCollection } from '../../../utils/mongodb';
import { unAuthorizedResponse, usePageResponseSuccess } from '../../../utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const {
    page = 1,
    pageSize = 20,
    name,
    code,
    status,
    startTime,
    endTime,
  } = getQuery(event);

  try {
    const rolesCollection = await getRolesCollection();
    
    // Build filter
    const filter: any = {};
    
    if (name) {
      filter.name = { $regex: name, $options: 'i' };
    }
    if (code) {
      filter.code = { $regex: code, $options: 'i' };
    }
    if (['0', '1'].includes(status as string)) {
      filter.status = Number(status);
    }
    if (startTime || endTime) {
      filter.createTime = {};
      if (startTime) {
        filter.createTime.$gte = startTime;
      }
      if (endTime) {
        filter.createTime.$lte = endTime;
      }
    }

    // Get total count
    const total = await rolesCollection.countDocuments(filter);
    
    // Pagination
    const pageNum = Number(page);
    const pageSizeNum = Number(pageSize);
    const skip = (pageNum - 1) * pageSizeNum;
    
    // Get data
    const roles = await rolesCollection
      .find(filter)
      .sort({ createTime: -1 })
      .skip(skip)
      .limit(pageSizeNum)
      .toArray();

    // Convert _id to id
    const listData = roles.map(({ _id, ...role }) => ({
      ...role,
      id: role.id || _id?.toString(),
    }));

    return usePageResponseSuccess(page as string, pageSize as string, listData);
  } catch (error) {
    console.error('Error fetching roles:', error);
    return {
      code: -1,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to fetch roles',
    };
  }
});
