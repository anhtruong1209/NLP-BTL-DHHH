import { baseRequestClient, requestClient } from '#/api/request';

export namespace AuthApi {
  /** 登录接口参数 */
  export interface LoginParams {
    email: string;
    password: string;
  }

  /** 注册接口参数 */
  export interface RegisterParams {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }

  /** 登录接口返回值 */
  export interface LoginResult {
    status: string;
    token: string;
    data: {
      user: {
        id: number;
        email: string;
        firstName?: string;
        lastName?: string;
        isAdmin?: boolean;
        role?: string;
      };
    };
  }

  /** 注册接口返回值 */
  export interface RegisterResult {
    status: string;
    token: string;
    data: {
      user: {
        id: number;
        email: string;
        firstName?: string;
        lastName?: string;
        isAdmin?: boolean;
        role?: string;
      };
    };
  }

  export interface RefreshTokenResult {
    data: string;
    status: number;
  }
}

/**
 * 登录 - 使用 email/password (không dùng SSO)
 */
export async function loginApi(data: AuthApi.LoginParams) {
  // Đảm bảo data không null/undefined và có email, password
  if (!data || !data.email || !data.password) {
    throw new Error('Email và password là bắt buộc');
  }
  
  // Sử dụng baseRequestClient để có control tốt hơn về headers
  const response = await baseRequestClient.post<AuthApi.LoginResult>('/auth/login', {
    email: data.email,
    password: data.password,
  }, {
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  // Response có thể là toàn bộ object hoặc chỉ data field tùy vào cách requestClient xử lý
  // Kiểm tra cả hai trường hợp
  const token = (response as any).token || (response as any).data?.token;
  const user = (response as any).data?.user || (response as any).user;
  
  if (!token) {
    throw new Error('Không nhận được token từ server');
  }
  
  return {
    accessToken: token,
    user,
  };
}

/**
 * 刷新accessToken - Tạm thời không hỗ trợ
 */
export async function refreshTokenApi() {
  return baseRequestClient.post<AuthApi.RefreshTokenResult>(
    '/auth/refresh',
    null,
    {
      withCredentials: true,
    },
  );
}

/**
 * 退出登录
 */
export async function logoutApi() {
  // Gửi empty object thay vì null để tránh lỗi parse JSON
  return baseRequestClient.post('/auth/logout', {}, {
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * 注册 - 使用 email/password
 */
export async function registerApi(data: AuthApi.RegisterParams) {
  // Đảm bảo data không null/undefined và có email, password
  if (!data || !data.email || !data.password) {
    throw new Error('Email và password là bắt buộc');
  }
  
  // Sử dụng baseRequestClient để có control tốt hơn về headers
  const response = await baseRequestClient.post<AuthApi.RegisterResult>('/auth/register', {
    email: data.email.trim().toLowerCase(),
    password: data.password,
    firstName: data.firstName?.trim() || null,
    lastName: data.lastName?.trim() || null,
  }, {
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  // Response có thể là toàn bộ object hoặc chỉ data field tùy vào cách requestClient xử lý
  const token = (response as any).token || (response as any).data?.token;
  const user = (response as any).data?.user || (response as any).user;
  
  if (!token) {
    throw new Error('Không nhận được token từ server');
  }
  
  return {
    accessToken: token,
    user,
  };
}

/**
 * 获取用户权限码 - Tạm thời trả về mảng rỗng
 */
export async function getAccessCodesApi() {
  try {
    return requestClient.get<string[]>('/auth/codes');
  } catch {
    return [];
  }
}
