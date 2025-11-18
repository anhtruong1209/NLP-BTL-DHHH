const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const axios = require('axios');
const User = require('../models/user.model');
const Log = require('../models/log.model');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// Hàm tạo password ngẫu nhiên
const generateRandomPassword = () => {
  return crypto.randomBytes(16).toString('hex');
};

// Trao đổi code lấy token từ WSO2
const exchangeCodeForToken = async (code, redirectUri) => {
  const tokenEndpoint = process.env.WSO2_TOKEN_ENDPOINT;
  const clientId = process.env.WSO2_CLIENT_ID;
  const clientSecret = process.env.WSO2_CLIENT_SECRET;

  if (!tokenEndpoint || !clientId || !clientSecret || !redirectUri) {
    throw new AppError('SSO config is missing (token endpoint / client credentials / redirectUri)', 500);
  }

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await axios.post(tokenEndpoint, params.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basic}`,
    },
    timeout: 15000,
  });

  return response.data; // { access_token, id_token, ... }
};

// Lấy user info từ WSO2
const fetchUserInfo = async (accessToken) => {
  const userInfoEndpoint = process.env.WSO2_USERINFO_ENDPOINT;
  if (!userInfoEndpoint) {
    throw new AppError('SSO userinfo endpoint is missing', 500);
  }
  const response = await axios.get(userInfoEndpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 15000,
  });
  return response.data;
};

// Tạo và gửi token JWT
const createSendToken = (user, statusCode, res, options = {}) => {
  if (!user) {
    throw new AppError('User object is null or undefined', 500);
  }
  
  if (!user.id) {
    throw new AppError('User object has no id property', 500);
  }

  if (!process.env.JWT_SECRET) {
    throw new AppError('JWT_SECRET is not configured', 500);
  }
  
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
  
  const cookieOptions = {
    expires: new Date(
      Date.now() + (Number(process.env.JWT_COOKIE_EXPIRES_IN) || 7) * 24 * 60 * 60 * 1000
    ),
    httpOnly: true
  };
  
  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;
  
  user.password = undefined;
  
  res.cookie('jwt', token, cookieOptions);
  res.status(statusCode).json({
    status: 'success',
    token,
    data: { user }
  });
};

// Đăng ký người dùng mới
exports.register = catchAsync(async (req, res, next) => {
  const { email, password, firstName, lastName } = req.body;
  
  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }
  
  const existingUser = await User.getUserByEmail(email);
  if (existingUser) {
    return next(new AppError('Email already in use', 409));
  }
  
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const newUser = await User.createUser({
    email,
    password: hashedPassword,
    firstName: firstName || null,
    lastName: lastName || null,
  });
  
  if (!newUser || !newUser.id) {
    throw new AppError('Error creating new user', 500);
  }
  
  // Log đăng ký người dùng mới
  await Log.createLog({
    userId: newUser.id,
    action: 'REGISTER',
    entityType: 'user',
    entityId: newUser.id,
    description: `Người dùng đã đăng ký tài khoản mới: ${newUser.email}`,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });
  
  createSendToken(newUser, 201, res);
});

// Đăng nhập
exports.login = catchAsync(async (req, res, next) => {
  const { email, password, is_sso, username, firstName, lastName, sso_id } = req.body;
  
  // Xử lý login qua SSO (giữ tương thích cũ)
  if (is_sso) {
    let user = await User.getUserByEmail(email);
    
    if (!user) {
      const randomPassword = generateRandomPassword();
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      
      user = await User.createUser({
        email,
        username,
        password: hashedPassword,
        firstName,
        lastName,
        sso_id,
        is_sso: true,
        isAdmin: false,
        lastLogin: new Date(),
        status: 'active'
      });
      
      await Log.createLog({
        userId: user.id,
        action: 'REGISTER',
        entityType: 'user',
        entityId: user.id,
        description: `Người dùng đã đăng ký qua SSO: ${user.email}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
    } else {
      user = await User.updateUser(user.id, {
        firstName,
        lastName,
        sso_id,
        lastLogin: new Date()
      });
    }
    
    await User.updateLoginTime(user.id);
    const updatedUser = await User.getUserById(user.id);
    
    await Log.createLog({
      userId: updatedUser.id,
      action: 'LOGIN',
      entityType: 'user',
      entityId: updatedUser.id,
      description: `Người dùng đã đăng nhập qua SSO: ${updatedUser.email}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    return createSendToken(updatedUser, 200, res);
  }

  // Xử lý login thông thường
  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }
  
  // Normalize email (trim và lowercase)
  const normalizedEmail = email.trim().toLowerCase();
  
  const user = await User.getUserByEmail(normalizedEmail);
  if (!user) {
    console.log(`[AUTH] User not found for email: ${normalizedEmail}`);
    return next(new AppError('Incorrect email or password', 401));
  }
  
  // Kiểm tra password hash format
  if (!user.password || typeof user.password !== 'string') {
    console.log(`[AUTH] Invalid password format for user: ${user.id}`);
    return next(new AppError('Incorrect email or password', 401));
  }
  
  // Kiểm tra xem password có phải bcrypt hash không (bắt đầu với $2a$, $2b$, $2y$)
  const isBcryptHash = /^\$2[ayb]\$.{56}$/.test(user.password);
  
  let passwordCorrect = false;
  if (isBcryptHash) {
    passwordCorrect = await bcrypt.compare(password, user.password);
  } else {
    // Nếu không phải bcrypt hash, có thể là plain text (không nên dùng trong production)
    console.warn(`[AUTH] Password for user ${user.id} is not bcrypt hash, comparing as plain text`);
    passwordCorrect = user.password === password;
  }
  
  if (!passwordCorrect) {
    console.log(`[AUTH] Password incorrect for user: ${user.id}`);
    return next(new AppError('Incorrect email or password', 401));
  }
  
  await User.updateLoginTime(user.id);
  const updatedUser = await User.getUserById(user.id);
  
  await Log.createLog({
    userId: updatedUser.id,
    action: 'LOGIN',
    entityType: 'user',
    entityId: updatedUser.id,
    description: `Người dùng đã đăng nhập với mật khẩu: ${updatedUser.email}`,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });
  
  createSendToken(updatedUser, 200, res);
});

// SSO callback xử lý tại BE: nhận code, trao đổi token, lấy user info và đồng bộ
exports.ssoCallback = catchAsync(async (req, res, next) => {
  const { code, redirectUri } = req.body;
  if (!code) {
    return next(new AppError('Authorization code is required', 400));
  }
  if (!redirectUri) {
    return next(new AppError('redirectUri is required and must match WSO2 app settings', 400));
  }

  // 1) Trao đổi code lấy token từ WSO2
  const tokenData = await exchangeCodeForToken(code, redirectUri);
  if (!tokenData || !tokenData.access_token) {
    return next(new AppError('Failed to get access token from SSO', 502));
  }

  // 2) Lấy user info từ WSO2
  const userInfo = await fetchUserInfo(tokenData.access_token);
  if (!userInfo || !userInfo.email) {
    return next(new AppError('Failed to fetch user info from SSO', 502));
  }

  // 3) Đồng bộ user vào DB
  const preferred = userInfo.preferred_username || '';
  const nameParts = preferred.split('_');
  const firstName = nameParts[1] || '';
  const lastName = nameParts[0] || '';

  let user = await User.getUserByEmail(userInfo.email);
  if (!user) {
    const randomPassword = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    user = await User.createUser({
      email: userInfo.email,
      username: userInfo.username || userInfo.email,
      password: hashedPassword,
      firstName,
      lastName,
      sso_id: userInfo.sub,
      is_sso: true,
      isAdmin: false,
      lastLogin: new Date(),
      status: 'active'
    });

    await Log.createLog({
      userId: user.id,
      action: 'REGISTER',
      entityType: 'user',
      entityId: user.id,
      description: `Người dùng đã đăng ký qua SSO: ${user.email}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  } else {
    user = await User.updateUser(user.id, {
      firstName,
      lastName,
      sso_id: userInfo.sub,
      lastLogin: new Date()
    });
  }

  await User.updateLoginTime(user.id);
  const updatedUser = await User.getUserById(user.id);

  await Log.createLog({
    userId: updatedUser.id,
    action: 'LOGIN',
    entityType: 'user',
    entityId: updatedUser.id,
    description: `Người dùng đã đăng nhập qua SSO (BE): ${updatedUser.email}`,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  // 4) Trả về JWT nội bộ + thông tin người dùng; không trả access token
  return createSendToken(updatedUser, 200, res);
});

// SSO token-login: FE gửi access_token, BE lấy user info và đồng bộ, trả JWT
exports.ssoTokenLogin = catchAsync(async (req, res, next) => {
  const { access_token: accessToken } = req.body;
  if (!accessToken) {
    return next(new AppError('access_token is required', 400));
  }

  // 1) Lấy user info từ WSO2 bằng access_token FE gửi lên
  const userInfo = await fetchUserInfo(accessToken);
  if (!userInfo || !userInfo.email) {
    return next(new AppError('Failed to fetch user info from SSO with provided access_token', 502));
  }

  // 2) Đồng bộ user vào DB
  const preferred = userInfo.preferred_username || '';
  const nameParts = preferred.split('_');
  const firstName = nameParts[1] || '';
  const lastName = nameParts[0] || '';

  let user = await User.getUserByEmail(userInfo.email);
  if (!user) {
    const randomPassword = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    user = await User.createUser({
      email: userInfo.email,
      username: userInfo.username || userInfo.email,
      password: hashedPassword,
      firstName,
      lastName,
      sso_id: userInfo.sub,
      is_sso: true,
      isAdmin: false,
      lastLogin: new Date(),
      status: 'active'
    });

    await Log.createLog({
      userId: user.id,
      action: 'REGISTER',
      entityType: 'user',
      entityId: user.id,
      description: `Người dùng đã đăng ký qua SSO (token): ${user.email}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  } else {
    user = await User.updateUser(user.id, {
      firstName,
      lastName,
      sso_id: userInfo.sub,
      lastLogin: new Date()
    });
  }

  await User.updateLoginTime(user.id);
  const updatedUser = await User.getUserById(user.id);

  await Log.createLog({
    userId: updatedUser.id,
    action: 'LOGIN',
    entityType: 'user',
    entityId: updatedUser.id,
    description: `Người dùng đã đăng nhập qua SSO (token): ${updatedUser.email}`,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  // 3) Trả về JWT nội bộ + thông tin user
  return createSendToken(updatedUser, 200, res);
});

// Đăng xuất
exports.logout = catchAsync(async (req, res, next) => {
  // Lấy userId từ token nếu có
  const userId = req.body.userId || (req.user ? req.user.id : null);
  const email = req.body.email || (req.user ? req.user.email : 'Unknown');

  // Ghi log đăng xuất
  if (userId) {
    await Log.createLog({
      userId: userId,
      action: 'LOGOUT',
      entityType: 'user',
      entityId: userId,
      description: `Người dùng đã đăng xuất: ${email}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }

  // Xóa cookie jwt nếu có
  res.clearCookie('jwt', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });

  res.status(200).json({
    status: 'success',
    message: 'Đăng xuất thành công'
  });
});

// Lấy thông tin người dùng hiện tại
exports.getMe = catchAsync(async (req, res) => {
  // Đảm bảo isAdmin được set đúng
  const user = { ...req.user };
  if (!user.hasOwnProperty('isAdmin')) {
    user.isAdmin = user.role === 'admin' || user.role === 'mode';
  }
  if (!user.hasOwnProperty('isMode')) {
    user.isMode = user.role === 'mode';
  }
  
  // Thêm cache-control headers để tránh 304 issues
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
  res.status(200).json(user);
});

// Cập nhật thông tin cá nhân
exports.updateProfile = catchAsync(async (req, res, next) => {
  const { firstName, lastName, avatar } = req.body;
  
  if (req.body.password || req.body.passwordConfirm) {
    return next(new AppError('This route is not for password updates. Please use /update-password', 400));
  }
  
  const updateData = {
    firstName,
    lastName,
    avatar
  };
  
  const updatedUser = await User.updateUser(req.user.id, updateData);
  res.status(200).json(updatedUser);
});

// Cập nhật mật khẩu
exports.updatePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    return next(new AppError('Please provide current and new password', 400));
  }
  
  const user = await User.getUserById(req.user.id);
  if (!user) {
    return next(new AppError('User not found', 404));
  }
  
  const passwordCorrect = await bcrypt.compare(currentPassword, user.password);
  if (!passwordCorrect) {
    return next(new AppError('Current password is incorrect', 401));
  }
  
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  const updatedUser = await User.updateUser(user.id, { password: hashedPassword });
  
  createSendToken(updatedUser, 200, res);
}); 