import type { Recordable, UserInfo } from '@vben/types';

import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';
import { resetAllStores, useAccessStore, useUserStore } from '@vben/stores';

import { notification } from 'ant-design-vue';
import { defineStore } from 'pinia';

import { getUserInfoApi, loginApi, logoutApi, registerApi } from '#/api';
import { $t } from '#/locales';

export const useAuthStore = defineStore('auth', () => {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const router = useRouter();

  const loginLoading = ref(false);
  const registerLoading = ref(false);

  /**
   * 异步处理登录操作
   * Asynchronously handle the login process
   * @param params 登录表单数据
   * @param onSuccess 成功之后的回调函数
   */
  async function authLogin(
    params: Recordable<any>,
    onSuccess?: () => Promise<void> | void,
  ) {
    // 异步处理用户登录操作并获取 accessToken
    let userInfo: null | UserInfo = null;
    try {
      loginLoading.value = true;
      // Map username thành email nếu có (tương thích với form cũ)
      const loginParams = {
        email: params.email || params.username,
        password: params.password,
      };
      const { accessToken } = await loginApi(loginParams);

      // 如果成功获取到 accessToken
      if (accessToken) {
        accessStore.setAccessToken(accessToken);
        
        // Reset access check để router guard có thể generate routes mới
        accessStore.setIsAccessChecked(false);

        // 获取用户信息并存储到 accessStore 中
        try {
          userInfo = await fetchUserInfo();
          userStore.setUserInfo(userInfo);
        } catch (error) {
          console.warn('[Auth] Failed to fetch user info, using default:', error);
          // Nếu không lấy được user info, vẫn tiếp tục với default path
          userInfo = {
            userId: '',
            username: params.email || params.username || '',
            realName: '',
            avatar: '',
            desc: '',
            token: accessToken,
            homePath: '/workspace',
            roles: ['user'],
            role: 'user',
          } as UserInfo;
          userStore.setUserInfo(userInfo);
        }
        
        // Bỏ accessCodes vì không cần thiết
        accessStore.setAccessCodes([]);

        if (accessStore.loginExpired) {
          accessStore.setLoginExpired(false);
        } else {
          // Đảm bảo luôn redirect, dùng homePath từ userInfo hoặc default
          const redirectPath = userInfo?.homePath || '/workspace' || preferences.app.defaultHomePath;
          
          if (onSuccess) {
            await onSuccess?.();
          } else {
            console.log('[Auth] Redirecting to:', redirectPath);
            // Dùng replace thay vì push để tránh lịch sử browser
            await router.replace(redirectPath);
          }
        }

        if (userInfo?.realName) {
          notification.success({
            description: `${$t('authentication.loginSuccessDesc')}:${userInfo?.realName}`,
            duration: 3,
            message: $t('authentication.loginSuccess'),
          });
        } else {
          notification.success({
            description: 'Đăng nhập thành công',
            duration: 3,
            message: $t('authentication.loginSuccess'),
          });
        }
      }
    } finally {
      loginLoading.value = false;
    }

    return {
      userInfo,
    };
  }

  async function logout(redirect: boolean = true) {
    try {
      await logoutApi();
    } catch {
      // 不做任何处理
    }

    resetAllStores();
    accessStore.setLoginExpired(false);

    // 回登录页带上当前路由地址
    await router.replace({
      path: LOGIN_PATH,
      query: redirect
        ? {
            redirect: encodeURIComponent(router.currentRoute.value.fullPath),
          }
        : {},
    });
  }

  /**
   * 异步处理注册操作
   * Asynchronously handle the registration process
   * @param params 注册表单数据
   * @param onSuccess 成功之后的回调函数
   */
  async function authRegister(
    params: Recordable<any>,
    onSuccess?: () => Promise<void> | void,
  ) {
    let userInfo: null | UserInfo = null;
    try {
      registerLoading.value = true;
      
      // Chuẩn bị dữ liệu đăng ký
      const registerParams = {
        email: params.email,
        password: params.password,
        firstName: params.firstName || null,
        lastName: params.lastName || null,
      };
      
      const { accessToken } = await registerApi(registerParams);

      // 如果成功获取到 accessToken
      if (accessToken) {
        accessStore.setAccessToken(accessToken);

        // Reset access check để router guard có thể generate routes mới
        accessStore.setIsAccessChecked(false);
        
        // 获取用户信息并存储到 accessStore 中
        try {
          userInfo = await fetchUserInfo();
          userStore.setUserInfo(userInfo);
        } catch (error) {
          console.warn('[Auth] Failed to fetch user info after register:', error);
          userInfo = {
            userId: '',
            username: registerParams.email || '',
            realName: registerParams.firstName && registerParams.lastName
              ? `${registerParams.firstName} ${registerParams.lastName}`
              : registerParams.firstName || registerParams.lastName || '',
            avatar: '',
            desc: '',
            token: accessToken,
            homePath: '/workspace',
            roles: ['user'],
            role: 'user',
          } as UserInfo;
          userStore.setUserInfo(userInfo);
        }
        
        // Bỏ accessCodes vì không cần thiết
        accessStore.setAccessCodes([]);

        if (accessStore.loginExpired) {
          accessStore.setLoginExpired(false);
        } else {
          const redirectPath = userInfo?.homePath || '/workspace' || preferences.app.defaultHomePath;
          
          if (onSuccess) {
            await onSuccess?.();
          } else {
            console.log('[Auth] Redirecting to after register:', redirectPath);
            await router.replace(redirectPath);
          }
        }

        if (userInfo?.realName) {
          notification.success({
            description: `Đăng ký thành công! Chào mừng ${userInfo?.realName}`,
            duration: 3,
            message: 'Đăng ký thành công',
          });
        } else {
          notification.success({
            description: 'Đăng ký thành công!',
            duration: 3,
            message: 'Đăng ký thành công',
          });
        }
      }
    } finally {
      registerLoading.value = false;
    }

    return {
      userInfo,
    };
  }

  async function fetchUserInfo() {
    let userInfo: null | UserInfo = null;
    userInfo = await getUserInfoApi();
    userStore.setUserInfo(userInfo);
    return userInfo;
  }

  function $reset() {
    loginLoading.value = false;
    registerLoading.value = false;
  }

  return {
    $reset,
    authLogin,
    authRegister,
    fetchUserInfo,
    loginLoading,
    registerLoading,
    logout,
  };
});
