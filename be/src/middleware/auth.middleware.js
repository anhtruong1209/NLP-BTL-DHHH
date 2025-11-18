const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const axios = require('axios');
const User = require('../models/user.model');
const ApiKey = require('../models/api-key.model');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

/**
 * Xác thực bằng SSO access token qua userinfo endpoint
 */
const authenticateWithSSOToken = async (token) => {
  const userInfoEndpoint = process.env.WSO2_USERINFO_ENDPOINT;
  if (!userInfoEndpoint) {
    throw new AppError('SSO userinfo endpoint is not configured', 500);
  }
  const { data } = await axios.get(userInfoEndpoint, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 15000,
  });
  return data; // kỳ vọng có email, sub, preferred_username
};

/**
 * Middleware bảo vệ route - hỗ trợ cả JWT nội bộ và SSO access_token
 */
exports.protect = catchAsync(async (req, res, next) => {
  // 1) Lấy token từ header/cookie
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  // if (!token) {
  //   return next(new AppError('Bạn chưa đăng nhập! Vui lòng đăng nhập để truy cập.', 401));
  // }

  // 2) Cố gắng xác thực như JWT nội bộ
  try {
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
    const currentUser = await User.getUserById(decoded.id);
    if (!currentUser) {
      return next(new AppError('Người dùng sở hữu token này không còn tồn tại.', 401));
    }
    req.user = currentUser;
    return next();
  } catch (err) {
    // Bỏ qua để thử SSO access token
  }

  // 3) Thử xác thực bằng SSO access token (userinfo)
  try {
    const userInfo = await authenticateWithSSOToken(token);
    const email = userInfo.email;
    const sub = userInfo.sub;

    if (!email && !sub) {
      return next(new AppError('Không thể xác thực SSO token', 401));
    }

    // Tìm user trong DB
    let currentUser = null;
    if (email) currentUser = await User.getUserByEmail(email);
    if (!currentUser && sub) {
      // Có thể có hàm tìm theo sso_id; nếu không, chỉ dựa vào email
      // currentUser = await User.getUserBySSOId(sub); // nếu có
    }

    if (!currentUser) {
      return next(new AppError('Tài khoản chưa được đăng ký trong hệ thống.', 401));
    }

    req.user = currentUser;
    return next();
  } catch (e) {
    return next(new AppError('Token không hợp lệ hoặc đã hết hạn.', 401));
  }
});

/**
 * Middleware xác thực thông qua API key
 */
exports.apiKeyAuth = catchAsync(async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return next(new AppError('API key không được cung cấp.', 401));
  }
  const validApiKey = await ApiKey.validateApiKey(apiKey);
  if (!validApiKey) {
    return next(new AppError('API key không hợp lệ hoặc đã hết hạn.', 401));
  }
  req.apiKey = validApiKey;
  next();
});

/**
 * Middleware hạn chế truy cập theo vai trò
 */
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // if (!req.user) {
    //   return next(new AppError('Bạn chưa đăng nhập! Vui lòng đăng nhập để truy cập.', 401));
    // }
    if (req.user.role === 'mode') {
      return next();
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError('Bạn không có quyền thực hiện hành động này.', 403));
    }
    next();
  };
};

exports.requireAdmin = catchAsync(async (req, res, next) => {
  if (req.user.role === 'mode') {
    return next();
  }
  if (req.user.role !== 'admin') {
    return next(new AppError('Chỉ quản trị viên mới có quyền truy cập trang này.', 403));
  }
  next();
});

exports.requireMode = catchAsync(async (req, res, next) => {
  if (req.user.role !== 'mode') {
    return next(new AppError('Chỉ người dùng có quyền Mode mới có thể truy cập trang này.', 403));
  }
  next();
});

// Attach SSO access token from header if provided
exports.attachSSOAccessToken = (req, res, next) => {
  const ssoToken = req.headers['x-sso-access-token'];
  if (ssoToken) {
    req.ssoAccessToken = ssoToken;
  }
  next();
};