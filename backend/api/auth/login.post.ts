import { defineEventHandler, readBody, setResponseStatus } from 'h3';
import {
  clearRefreshTokenCookie,
  setRefreshTokenCookie,
} from '../../utils/cookie-utils';
import { generateAccessToken, generateRefreshToken } from '../../utils/jwt-utils';
import { getUsersCollection } from '../../utils/mongodb';
import { comparePassword, isPasswordHashed, hashPassword } from '../../utils/password-utils';
import {
  forbiddenResponse,
  useResponseError,
  useResponseSuccess,
} from '../../utils/response';

export default defineEventHandler(async (event) => {
  const { password, username } = await readBody(event);
  if (!password || !username) {
    setResponseStatus(event, 400);
    return useResponseError(
      'BadRequestException',
      'Username and password are required',
    );
  }

  try {
    console.log('🔐 Login attempt:', { username, passwordLength: password?.length });
    
    const usersCollection = await getUsersCollection();
    
    // Tìm user theo username trước
    const findUser = await usersCollection.findOne({
      username,
      status: 1, // Chỉ cho phép đăng nhập user đang active
    });

    console.log('👤 User found:', findUser ? 'Yes' : 'No');
    if (findUser) {
      console.log('👤 User details:', { 
        username: findUser.username, 
        hasPassword: !!findUser.password,
        passwordLength: findUser.password?.length,
        passwordStart: findUser.password?.substring(0, 10) 
      });
    }
    
    if (!findUser) {
      console.log('❌ User not found or inactive');
      clearRefreshTokenCookie(event);
      return forbiddenResponse(event, 'Username or password is incorrect.');
    }

    // Kiểm tra password
    const userPassword = findUser.password || '';
    console.log('🔑 Checking password...', { 
      hasPassword: !!userPassword, 
      isHashed: isPasswordHashed(userPassword),
      passwordStart: userPassword.substring(0, 10) 
    });
    
    // Nếu password chưa được hash (migration từ plain text), so sánh plain text
    let isMatch = false;
    try {
      if (!isPasswordHashed(userPassword)) {
        // Migration: so sánh plain text, nếu đúng thì hash và lưu lại
        console.log('⚠️ Password not hashed, comparing plain text...');
        if (userPassword === password) {
          isMatch = true;
          console.log('✅ Plain text password matches, hashing now...');
          const hashedPassword = await hashPassword(password);
          await usersCollection.updateOne(
            { _id: findUser._id },
            { $set: { password: hashedPassword } }
          );
          console.log('✅ Password hashed and saved');
        } else {
          console.log('❌ Plain text password mismatch');
        }
      } else {
        // So sánh password đã hash
        console.log('🔐 Comparing hashed password...');
        console.log('🔐 Input password:', password);
        console.log('🔐 Stored hash:', userPassword.substring(0, 20) + '...');
        isMatch = await comparePassword(password, userPassword);
        console.log('🔐 Password comparison result:', isMatch);
        
        // Nếu không khớp, có thể hash trong DB bị lỗi hoặc password đã thay đổi
        // Thử test với các password mặc định
        if (!isMatch) {
          const defaultPasswords = ['admin@123', 'user@123'];
          let foundMatch = false;
          
          for (const defaultPwd of defaultPasswords) {
            const testMatch = await comparePassword(defaultPwd, userPassword);
            if (testMatch) {
              console.log(`⚠️ Stored hash matches default password: ${defaultPwd}`);
              foundMatch = true;
              // Nếu user nhập đúng password mặc định, update hash mới
              if (password === defaultPwd) {
                console.log('⚠️ Re-hashing password for consistency...');
                const newHash = await hashPassword(password);
                await usersCollection.updateOne(
                  { _id: findUser._id },
                  { $set: { password: newHash } }
                );
                isMatch = true;
                console.log('✅ Password re-hashed and updated');
              }
              break;
            }
          }
          
          if (!foundMatch) {
            console.log('❌ Password does not match any known hash');
          }
        }
      }
    } catch (pwdError: any) {
      console.error('❌ Password check error:', pwdError);
      console.error('Error details:', pwdError?.message, pwdError?.stack);
      // Nếu lỗi do bcryptjs chưa được cài, fallback về plain text comparison
      if (pwdError?.message?.includes('bcryptjs') || pwdError?.message?.includes('Cannot find module')) {
        console.log('⚠️ bcryptjs not available, falling back to plain text comparison');
        isMatch = userPassword === password;
        if (isMatch) {
          console.log('⚠️ Plain text match (bcryptjs not installed)');
        }
      } else {
        throw pwdError;
      }
    }
    
    if (!isMatch) {
      console.log('❌ Password mismatch');
      clearRefreshTokenCookie(event);
      return forbiddenResponse(event, 'Username or password is incorrect.');
    }

    console.log('✅ Login successful for user:', username);

    // Chuyển đổi sang format UserInfo cho JWT
    const userInfo = {
      id: Number(findUser.id.replace(/\D/g, '')) || 0,
      username: findUser.username,
      realName: findUser.realName,
      roles: findUser.roles,
      homePath: findUser.homePath,
    };

    const accessToken = generateAccessToken(userInfo);
    const refreshToken = generateRefreshToken(userInfo);

    setRefreshTokenCookie(event, refreshToken);

    return useResponseSuccess({
      ...userInfo,
      accessToken,
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    console.error('Error details:', error instanceof Error ? error.message : error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    clearRefreshTokenCookie(event);
    
    // Nếu lỗi liên quan đến bcryptjs, trả về message rõ ràng hơn
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('bcryptjs') || errorMessage.includes('Cannot find module')) {
      event.node.res.statusCode = 500;
      return useResponseError(
        'InternalServerError',
        'Password hashing service is not available. Please contact administrator or run: pnpm install'
      );
    }
    
    return forbiddenResponse(event, `Login failed: ${errorMessage}`);
  }
});
