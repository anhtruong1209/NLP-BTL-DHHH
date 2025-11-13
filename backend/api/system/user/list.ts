import { eventHandler, getQuery } from 'h3';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { getRolesCollection, getUsersCollection } from '~/utils/mongodb';
import { unAuthorizedResponse, usePageResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const {
    page = 1,
    pageSize = 20,
    username,
    realName,
    email,
    phone,
    status,
    startTime,
    endTime,
  } = getQuery(event);

  try {
    const usersCollection = await getUsersCollection();
    
    // Xây dựng query filter
    const filter: any = {};
    
    if (username) {
      filter.username = { $regex: username, $options: 'i' };
    }
    if (realName) {
      filter.realName = { $regex: realName, $options: 'i' };
    }
    if (email) {
      filter.email = { $regex: email, $options: 'i' };
    }
    if (phone) {
      filter.phone = { $regex: phone };
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

    // Lấy tổng số documents
    const total = await usersCollection.countDocuments(filter);
    
    // Phân trang
    const pageNum = Number(page);
    const pageSizeNum = Number(pageSize);
    const skip = (pageNum - 1) * pageSizeNum;
    
    // Lấy dữ liệu
    const users = await usersCollection
      .find(filter)
      .sort({ createTime: -1 })
      .skip(skip)
      .limit(pageSizeNum)
      .toArray();

    // Lấy danh sách roles để map role code với role name
    const rolesCollection = await getRolesCollection();
    const roles = await rolesCollection.find({}).toArray();
    const roleMap = new Map();
    roles.forEach((role) => {
      roleMap.set(role.code, { name: role.name, code: role.code });
    });

    // Chuyển đổi _id thành id và loại bỏ _id và password, thêm roleName
    const listData = users.map(({ _id, password, ...user }) => {
      const roleCode = user.role?.toString() || user.role;
      const roleInfo = roleMap.get(roleCode);
      return {
      ...user,
      id: user.id || _id?.toString(),
        roleName: roleInfo?.name || '',
        roleCode: roleCode,
      };
    });

    return {
      code: 0,
      data: {
        items: listData,
        total,
      },
      error: null,
      message: 'ok',
    };
  } catch (error) {
    console.error('Error fetching users:', error);
    return {
      code: -1,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to fetch users',
    };
  }
});

