import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';
import axios from 'axios';
import { useAppConfig } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';

export namespace SystemUserApi {
  export interface SystemUser {
    [key: string]: any;
    id: string;
    username: string;
    realName: string;
    email?: string;
    phone?: string;
    roles: string[];
    status: 0 | 1;
    createTime?: string;
    remark?: string;
  }
}

/**
 * 获取用户列表数据 - Backend mới dùng /api/users (admin only)
 * Backend trả về array trực tiếp hoặc có thể có pagination
 */
async function getUserList(params: Recordable<any>) {
  try {
    // Dùng baseRequestClient để bypass interceptor (backend trả về array trực tiếp)
    const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
    const accessStore = useAccessStore();
    const response = await axios.get(`${apiURL}/users`, {
      params,
      headers: {
        Authorization: accessStore.accessToken ? `Bearer ${accessStore.accessToken}` : '',
      },
      withCredentials: true,
    });
    const res = response.data;
    console.log('[getUserList] Raw response:', res);
    
    // Backend có thể trả về array trực tiếp hoặc wrapped
    let users: any[] = [];
    
    if (Array.isArray(res)) {
      users = res;
    } else if (res && typeof res === 'object') {
      if (Array.isArray(res.data)) {
        users = res.data;
      } else if (Array.isArray(res.items)) {
        users = res.items;
      } else if (res.results && Array.isArray(res.results)) {
        users = res.results;
      }
    }
    
    console.log('[getUserList] Extracted users:', users);
    
    // Map backend user format sang SystemUser format
    const mappedUsers: SystemUserApi.SystemUser[] = users.map((user: any) => ({
      id: String(user.id || user.userId || ''),
      username: user.username || user.email || '',
      realName: user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : user.firstName || user.lastName || user.realName || user.username || '',
      email: user.email || '',
      phone: user.phone || '',
      roles: user.role === 'admin' || user.role === 'mode' || user.isAdmin 
        ? ['admin'] 
        : ['user'],
      status: user.status === 'active' || user.status === 1 || user.status === '1' ? 1 : 0,
      createTime: user.createdAt || user.createTime || '',
      remark: user.remark || user.desc || '',
    }));
    
    console.log('[getUserList] Mapped users:', mappedUsers);
    
    // Trả về format mà vxe-table expect: { items, total }
    return {
      items: mappedUsers,
      total: mappedUsers.length,
    };
  } catch (error: any) {
    console.log('[getUserList] Error caught:', error);
    console.log('[getUserList] error type:', typeof error);
    console.log('[getUserList] error.response:', error?.response);
    console.log('[getUserList] error.response?.data:', error?.response?.data);
    
    // Nếu error chính nó là array (interceptor throw error nhưng data là array)
    if (Array.isArray(error)) {
      console.log('[getUserList] Error is array, mapping and returning');
      const mappedUsers = error.map((user: any) => ({
        id: String(user.id || ''),
        username: user.username || user.email || '',
        realName: user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}` 
          : user.firstName || user.lastName || user.username || '',
        email: user.email || '',
        phone: user.phone || '',
        roles: user.role === 'admin' || user.role === 'mode' ? ['admin'] : ['user'],
        status: user.status === 'active' || user.status === 1 ? 1 : 0,
        createTime: user.createdAt || '',
        remark: user.remark || '',
      }));
      return {
        items: mappedUsers,
        total: mappedUsers.length,
      };
    }
    
    // Nếu error có data property là array
    if (error?.data && Array.isArray(error.data)) {
      console.log('[getUserList] Error.data is array, mapping and returning');
      const mappedUsers = error.data.map((user: any) => ({
        id: String(user.id || ''),
        username: user.username || user.email || '',
        realName: user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}` 
          : user.firstName || user.lastName || user.username || '',
        email: user.email || '',
        phone: user.phone || '',
        roles: user.role === 'admin' || user.role === 'mode' ? ['admin'] : ['user'],
        status: user.status === 'active' || user.status === 1 ? 1 : 0,
        createTime: user.createdAt || '',
        remark: user.remark || '',
      }));
      return {
        items: mappedUsers,
        total: mappedUsers.length,
      };
    }
    
    // Nếu error nhưng có response data
    if (error?.response?.data) {
      const data = error.response.data;
      if (Array.isArray(data)) {
        console.log('[getUserList] error.response.data is array, mapping and returning');
        const mappedUsers = data.map((user: any) => ({
          id: String(user.id || ''),
          username: user.username || user.email || '',
          realName: user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user.firstName || user.lastName || user.username || '',
          email: user.email || '',
          phone: user.phone || '',
          roles: user.role === 'admin' || user.role === 'mode' ? ['admin'] : ['user'],
          status: user.status === 'active' || user.status === 1 ? 1 : 0,
          createTime: user.createdAt || '',
          remark: user.remark || '',
        }));
        return {
          items: mappedUsers,
          total: mappedUsers.length,
        };
      }
    }
    
    console.error('[getUserList] No valid data found, throwing error');
    throw error;
  }
}

/**
 * 创建用户 - Backend mới dùng /api/users (admin only)
 * @param data 用户数据
 */
async function createUser(data: Omit<SystemUserApi.SystemUser, 'id'>) {
  // Map frontend format sang backend format
  const formData = data as any;
  
  if (!formData.password) {
    throw new Error('Mật khẩu là bắt buộc khi tạo người dùng mới');
  }
  
  const backendData: any = {
    email: data.email || data.username || '',
    password: formData.password,
    firstName: data.realName?.split(' ')[0] || '',
    lastName: data.realName?.split(' ').slice(1).join(' ') || '',
    role: data.roles?.includes('admin') ? 'admin' : 'user',
    status: data.status === 1 ? 'active' : 'inactive',
  };
  
  return requestClient.post('/users', backendData);
}

/**
 * 更新用户 - Backend mới dùng PATCH /api/users/:id (admin only)
 * @param id 用户 ID
 * @param data 用户数据
 */
async function updateUser(
  id: string,
  data: Omit<SystemUserApi.SystemUser, 'id'>,
) {
  // Map frontend format sang backend format
  const backendData: any = {};
  
  if (data.realName) {
    const nameParts = data.realName.split(' ');
    backendData.firstName = nameParts[0] || '';
    backendData.lastName = nameParts.slice(1).join(' ') || '';
  }
  
  if (data.roles) {
    backendData.role = data.roles.includes('admin') ? 'admin' : 'user';
  }
  
  if (data.status !== undefined) {
    backendData.status = data.status === 1 ? 'active' : 'inactive';
  }
  
  if (data.email) {
    backendData.email = data.email;
  }
  
  // Backend dùng PATCH, cần dùng axios trực tiếp
  const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
  const accessStore = useAccessStore();
  const response = await axios.patch(`${apiURL}/users/${id}`, backendData, {
    headers: {
      Authorization: accessStore.accessToken ? `Bearer ${accessStore.accessToken}` : '',
      'Content-Type': 'application/json',
    },
    withCredentials: true,
  });
  return response.data;
}

/**
 * 删除用户 - Backend mới dùng /api/users/:id (admin only)
 * @param id 用户 ID
 */
async function deleteUser(id: string) {
  return requestClient.delete(`/users/${id}`);
}

export { createUser, deleteUser, getUserList, updateUser };

