import type { UserInfo } from '@vben/types';

import { useAccessStore } from '@vben/stores';
import axios from 'axios';
import { useAppConfig } from '@vben/hooks';

/**
 * 获取用户信息 - Backend mới dùng /api/auth/me
 * Backend trả về req.user trực tiếp (không wrap trong data)
 */
export async function getUserInfoApi() {
  // Dùng axios trực tiếp để bypass interceptor có thể transform sai
  const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
  const accessStore = useAccessStore();
  
  try {
    // Thêm timestamp để tránh 304 cache
    const response = await axios.get(`${apiURL}/auth/me`, {
      params: { _t: Date.now() },
      headers: {
        Authorization: accessStore.accessToken ? `Bearer ${accessStore.accessToken}` : '',
      },
      withCredentials: true,
    });
    
    console.log('[getUserInfoApi] Raw axios response:', response);
    console.log('[getUserInfoApi] response.data:', response.data);
    
    // Backend trả về user object trực tiếp trong response.data
    const user = response.data;
    
    console.log('[getUserInfoApi] Final user object:', user);
    console.log('[getUserInfoApi] user.role:', user?.role);
    console.log('[getUserInfoApi] user.isAdmin:', user?.isAdmin);
    
    // Xác định role: check cả isAdmin và role field
    const isAdmin = user.isAdmin === true || user.role === 'admin' || user.role === 'mode';
    const role = isAdmin ? 'admin' : 'user';
    
    console.log('[getUserInfoApi] Calculated isAdmin:', isAdmin);
    console.log('[getUserInfoApi] Calculated role:', role);
    
    const token = accessStore.accessToken || '';
    
    const userInfo = {
      userId: String(user.id || user.userId || ''),
      username: user.email || user.username || '',
      realName: user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : user.firstName || user.lastName || user.username || '',
      avatar: user.avatar || '',
      desc: user.desc || '',
      token: token,
      homePath: '/workspace',
      roles: isAdmin ? ['admin'] : ['user'],
      role: role,
      // Thêm isAdmin để dễ check
      isAdmin: isAdmin,
    } as UserInfo & { isAdmin?: boolean };
    
    console.log('[getUserInfoApi] Returning userInfo:', userInfo);
    
    return userInfo;
  } catch (error: any) {
    console.log('[getUserInfoApi] Error caught:', error);
    console.log('[getUserInfoApi] error.response:', error?.response);
    console.log('[getUserInfoApi] error.response?.data:', error?.response?.data);
    
    // Nếu có error nhưng response data hợp lệ (304 Not Modified hoặc interceptor issue)
    if (error?.response?.data) {
      let user = error.response.data;
      
      // Nếu data có data field (từ interceptor)
      if (user && typeof user === 'object' && 'data' in user) {
        user = user.data;
      }
      
      console.log('[getUserInfoApi] Extracted user from error.response.data:', user);
      console.log('[getUserInfoApi] user.role:', user?.role);
      console.log('[getUserInfoApi] user.isAdmin:', user?.isAdmin);
      
      const isAdmin = user.isAdmin === true || user.role === 'admin' || user.role === 'mode';
      const role = isAdmin ? 'admin' : 'user';
      
      console.log('[getUserInfoApi] Calculated isAdmin from error:', isAdmin);
      console.log('[getUserInfoApi] Calculated role from error:', role);
      
      // Lấy token từ accessStore nếu có
      const accessStore = useAccessStore();
      const token = accessStore.accessToken || '';
      
      const userInfo = {
        userId: String(user.id || user.userId || ''),
        username: user.email || user.username || '',
        realName: user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}` 
          : user.firstName || user.lastName || user.username || '',
        avatar: user.avatar || '',
        desc: user.desc || '',
        token: token,
        homePath: '/workspace',
        roles: isAdmin ? ['admin'] : ['user'],
        role: role,
        // Thêm isAdmin để dễ check
        isAdmin: isAdmin,
      } as UserInfo & { isAdmin?: boolean };
      
      console.log('[getUserInfoApi] Returning userInfo from error:', userInfo);
      
      return userInfo;
    }
    throw error;
  }
}
