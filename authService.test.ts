import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import authService, { RegisterDTO, LoginDTO, ChangePasswordDTO, ForgotPasswordDTO, ResetPasswordDTO, UpdateProfileDTO } from '../services/authService';
import User from '../models/User';
import bcrypt from 'bcryptjs';

/**
 * Feature 1: Authentication & Authorization - COMPLETE Tests
 * Bao phủ TOÀN BỘ chức năng thực tế trên web:
 * - Đăng ký (register)
 * - Đăng nhập (login)
 * - Refresh token
 * - Quên mật khẩu (forgot password + OTP)
 * - Đặt lại mật khẩu (reset password)
 * - Đổi mật khẩu (change password)
 * - Cập nhật profile (update profile)
 */
describe('[Feature 1] Authentication & Authorization - Complete Unit Tests', () => {
  let createdUserId: number | undefined;
  let createdUserPassword: string | undefined;
  let testEmail = 'test_auth_' + Date.now() + '@example.com';
  let createdUsers: number[] = [];

  beforeAll(async () => {
    console.log('🔐 Bắt đầu kiểm thử Xác Thực & Phân Quyền...');
  });

  afterAll(async () => {
    // Cleanup: Xóa tất cả users đã tạo
    for (const userId of createdUsers) {
      await User.destroy({ where: { id: userId } }).catch(() => {});
    }
    console.log('✅ Rollback complete: Đã xóa tất cả test users');
  });

  /**
   * [TC_AUTH_001] Đăng ký tài khoản thành công
   * Mục tiêu: Kiểm tra register với dữ liệu hợp lệ
   * Input: {username, email, password ≥ 6 ký tự, phone}
   * Expected: Tạo user trong DB, trả về user info (không có password)
   * DB Check: Tìm user bằng findByPk
   * Rollback: Xóa user trong afterAll
   */
  it('[TC_AUTH_001] should register new user successfully', async () => {
    const registerData: RegisterDTO = {
      username: 'testuser_auth',
      email: testEmail,
      password: 'password123',
      phone: '0901234567'
    };

    const result = await authService.register(registerData);

    expect(result).toBeDefined();
    expect(result.user).toBeDefined();
    expect(result.user.username).toBe(registerData.username);
    expect(result.user.email).toBe(registerData.email);
    expect(result.user.phone).toBe(registerData.phone);
    expect(result.user.id).toBeDefined();

    // DB Check
    createdUserId = result.user.id;
    createdUserPassword = registerData.password;
    createdUsers.push(createdUserId);
    
    const dbUser = await User.findByPk(createdUserId);
    expect(dbUser).not.toBeNull();
    if (dbUser) {
      expect(dbUser.username).toBe(registerData.username);
      expect(dbUser.email).toBe(registerData.email);
      expect(dbUser.password_hash).not.toBe(registerData.password);
      expect(dbUser.password_hash).toBeDefined();
      expect(dbUser.is_active).toBe(true);
    }

    console.log(`✅ TC_AUTH_001: Đăng ký thành công, user ID ${createdUserId}`);
  });

  /**
   * [TC_AUTH_002] Đăng ký với email trùng
   */
  it('[TC_AUTH_002] should fail when registering with duplicate email', async () => {
    const duplicateEmailData: RegisterDTO = {
      username: 'anotheruser',
      email: testEmail,
      password: 'password123',
      phone: '0909999999'
    };

    await expect(authService.register(duplicateEmailData)).rejects.toThrow('Trùng email');

    console.log('✅ TC_AUTH_002: Từ chối email trùng');
  });

  /**
   * [TC_AUTH_003] Đăng ký với username trùng
   */
  it('[TC_AUTH_003] should fail when registering with duplicate username', async () => {
    const email2 = 'test_auth_2_' + Date.now() + '@example.com';
    const duplicateUsernameData: RegisterDTO = {
      username: 'testuser_auth', // Trùng username với TC_AUTH_001
      email: email2,
      password: 'password123',
      phone: '0908888888'
    };

    await expect(authService.register(duplicateUsernameData)).rejects.toThrow('Tên người dùng đã được sử dụng');

    console.log('✅ TC_AUTH_003: Từ chối username trùng');
  });

  /**
   * [TC_AUTH_004] Đăng ký với password quá ngắn (< 6 ký tự)
   */
  it('[TC_AUTH_004] should fail when password is less than 6 characters', async () => {
    const email3 = 'test_auth_3_' + Date.now() + '@example.com';
    const shortPasswordData: RegisterDTO = {
      username: 'testuser_short',
      email: email3,
      password: '12345', // Chỉ 5 ký tự
      phone: '0901111111'
    };

    await expect(authService.register(shortPasswordData)).rejects.toThrow('Mật khẩu phải có ít nhất 6 ký tự');

    console.log('✅ TC_AUTH_004: Từ chối password ngắn');
  });

  /**
   * [TC_AUTH_005] Đăng ký thiếu thông tin bắt buộc
   */
  it('[TC_AUTH_005] should fail when required fields are missing', async () => {
    const incompleteData: any = {
      username: 'testuser_incomplete',
      // Thiếu email và password
      phone: '0902222222'
    };

    await expect(authService.register(incompleteData)).rejects.toThrow('Vui lòng nhập đầy đủ thông tin đăng ký');

    console.log('✅ TC_AUTH_005: Từ chối thiếu thông tin');
  });

  /**
   * [TC_AUTH_006] (merged: wrong password + non-existent email)
   * Mục tiêu: Đăng nhập sai credentials
   */
  it('[TC_AUTH_006] should fail when login with wrong credentials', async () => {
    // Test wrong password
    const wrongPasswordData: LoginDTO = {
      email: testEmail,
      password: 'wrongpassword'
    };
    await expect(authService.login(wrongPasswordData)).rejects.toThrow('Sai mật khẩu');

    // Test non-existent email
    const nonExistentEmailData: LoginDTO = {
      email: 'nonexistent_' + Date.now() + '@example.com',
      password: 'password123'
    };
    await expect(authService.login(nonExistentEmailData)).rejects.toThrow('Sai tài khoản');

    console.log('✅ TC_AUTH_006: Từ chối sai credentials');
  });

  /**
   * [TC_AUTH_007] Đăng nhập với tài khoản bị vô hiệu hóa
   */
  it('[TC_AUTH_007] should fail when account is inactive', async () => {
    // Tạo user inactive
    const email4 = 'test_auth_inactive_' + Date.now() + '@example.com';
    const hashedPassword = await bcrypt.hash('password123', 10);
    const inactiveUser = await User.create({
      username: 'inactive_user',
      email: email4,
      password_hash: hashedPassword,
      phone: '0907777777',
      is_active: false
    });
    createdUsers.push(inactiveUser.id);

    const loginData: LoginDTO = {
      email: email4,
      password: 'password123'
    };

    await expect(authService.login(loginData)).rejects.toThrow('Tài khoản đã bị vô hiệu hóa');

    console.log('✅ TC_AUTH_007: Từ chối tài khoản inactive');
  });

  /**
   * [TC_AUTH_008] (merged: missing email + missing password)
   * Mục tiêu: Đăng nhập thiếu email/password
   */
  it('[TC_AUTH_008] should fail when login credentials are missing', async () => {
    // Test missing password
    const incompleteLogin: any = {
      email: testEmail,
    };
    await expect(authService.login(incompleteLogin)).rejects.toThrow('Vui lòng nhập đầy đủ email và mật khẩu');

    // Test missing email
    const missingEmail: any = {
      password: 'password123'
    };
    await expect(authService.login(missingEmail)).rejects.toThrow('Vui lòng nhập đầy đủ email và mật khẩu');

    console.log('✅ TC_AUTH_008: Từ chối thiếu credentials');
  });

  /**
   * [TC_AUTH_009] Refresh token với token hợp lệ
   */
  it('[TC_AUTH_009] should refresh token successfully', async () => {
    // Login để lấy refresh token
    const loginResult = await authService.login({
      email: testEmail,
      password: createdUserPassword || 'password123'
    });

    const result = await authService.refreshToken(loginResult.refreshToken);

    expect(result).toBeDefined();
    expect(result.accessToken).toBeDefined();
    expect(typeof result.accessToken).toBe('string');

    console.log('✅ TC_AUTH_009: Refresh token thành công');
  });

  /**
   * [TC_AUTH_010] Refresh token với token không hợp lệ
   */
  it('[TC_AUTH_010] should fail with invalid refresh token', async () => {
    const invalidToken = 'invalid.token.here';

    await expect(authService.refreshToken(invalidToken)).rejects.toThrow();

    console.log('✅ TC_AUTH_010: Từ chối invalid refresh token');
  });



  /**
   * [TC_AUTH_011] Forgot password với email không tồn tại
   */
  it('[TC_AUTH_011] should fail with non-existent email for forgot password', async () => {
    const forgotData: ForgotPasswordDTO = {
      email: 'nonexistent_' + Date.now() + '@example.com'
    };

    // Function này throw error nếu email không tồn tại
    await expect(authService.forgotPassword(forgotData)).rejects.toThrow('Email không tồn tại trong hệ thống');

    console.log('✅ TC_AUTH_011: Từ chối email không tồn tại');
  });

  /**
   * [TC_AUTH_012] Change password thành công
   */
  it('[TC_AUTH_012] should change password successfully', async () => {
    if (!createdUserId) {
      throw new Error('User chưa được tạo');
    }

    const changePasswordData: ChangePasswordDTO = {
      current_password: createdUserPassword || 'password123',
      new_password: 'newpassword456'
    };

    const result = await authService.changePassword(createdUserId, changePasswordData);

    expect(result).toBeDefined();
    expect(result).toBe(true);

    // Update stored password
    createdUserPassword = 'newpassword456';

    console.log('✅ TC_AUTH_012: Đổi mật khẩu thành công');
  });

  /**
   * [TC_AUTH_013] Change password với current password sai
   */
  it('[TC_AUTH_013] should fail change password with wrong current password', async () => {
    if (!createdUserId) {
      throw new Error('User chưa được tạo');
    }

    const wrongCurrentData: ChangePasswordDTO = {
      current_password: 'wrongpassword',
      new_password: 'newpassword789'
    };

    await expect(authService.changePassword(createdUserId, wrongCurrentData)).rejects.toThrow();

    console.log('✅ TC_AUTH_013: Từ chối current password sai');
  });

  /**
   * [TC_AUTH_014] Change password với user không tồn tại
   */
  it('[TC_AUTH_014] should fail change password for non-existent user', async () => {
    const changeData: ChangePasswordDTO = {
      current_password: 'password123',
      new_password: 'newpassword123'
    };

    await expect(authService.changePassword(9999999, changeData)).rejects.toThrow('Người dùng không tồn tại');

    console.log('✅ TC_AUTH_014: Từ chối user không tồn tại');
  });


  /**
   * [TC_AUTH_015] Update profile với email trùng
   */
  it('[TC_AUTH_015] should fail update profile with duplicate email', async () => {
    // Tạo user khác để test email trùng
    const email5 = 'test_auth_5_' + Date.now() + '@example.com';
    const hashedPassword = await bcrypt.hash('password123', 10);
    const otherUser = await User.create({
      username: 'other_user',
      email: email5,
      password_hash: hashedPassword,
      phone: '0906666666',
      is_active: true
    });
    createdUsers.push(otherUser.id);

    if (!createdUserId) {
      throw new Error('User chưa được tạo');
    }

    const updateData: UpdateProfileDTO = {
      email: email5 // Email đã có user khác sử dụng
    };

    await expect(authService.updateProfile(createdUserId, updateData)).rejects.toThrow('Email đã được sử dụng');

    console.log('✅ TC_AUTH_015: Từ chối email trùng khi update');
  });

  /**
   * [TC_AUTH_016] Update profile với user không tồn tại
   */
  it('[TC_AUTH_016] should fail update profile for non-existent user', async () => {
    const updateData: UpdateProfileDTO = {
      username: 'new_username'
    };

    await expect(authService.updateProfile(9999999, updateData)).rejects.toThrow('Người dùng không tồn tại');

    console.log('✅ TC_AUTH_016: Từ chối update user không tồn tại');
  });

  /**
   * [TC_AUTH_017] Update profile với avatar_url và các field khác
   */
  it('[TC_AUTH_017] should update profile with avatar_url and all fields', async () => {
    if (!createdUserId) {
      throw new Error('User chưa được tạo');
    }

    const updateData: UpdateProfileDTO = {
      username: 'updated_with_avatar',
      phone: '0908888888',
      gender: 'female',
      avatar_url: 'https://example.com/avatar.jpg'
    };

    const result = await authService.updateProfile(createdUserId, updateData);

    expect(result).toBeDefined();
    expect(result.username).toBe(updateData.username);
    expect(result.phone).toBe(updateData.phone);
    expect(result.gender).toBe(updateData.gender);
    expect(result.avatar_url).toBe(updateData.avatar_url);

    // DB Check
    const dbUser = await User.findByPk(createdUserId);
    expect(dbUser).not.toBeNull();
    if (dbUser) {
      expect(dbUser.avatar_url).toBe(updateData.avatar_url);
    }

    console.log('✅ TC_AUTH_017: Cập nhật profile với avatar_url thành công');
  });

  /**
   * [TC_AUTH_018] Update profile với dữ liệu rỗng
   */
  it('[TC_AUTH_018] should fail update profile with empty data', async () => {
    if (!createdUserId) {
      throw new Error('User chưa được tạo');
    }

    const emptyData: UpdateProfileDTO = {};

    await expect(authService.updateProfile(createdUserId, emptyData)).rejects.toThrow('Không có dữ liệu nào để cập nhật');

    console.log('✅ TC_AUTH_018: Từ chối update với dữ liệu rỗng');
  });

  /**
   * [TC_AUTH_019] Login với input không phải string
   */
  it('[TC_AUTH_019] should fail when login with non-string credentials', async () => {
    await expect(
      authService.login({
        email: 12345 as any,
        password: 'password123'
      })
    ).rejects.toThrow('Email và mật khẩu phải là chuỗi');

    await expect(
      authService.login({
        email: testEmail,
        password: 12345 as any
      })
    ).rejects.toThrow('Email và mật khẩu phải là chuỗi');

    console.log('✅ TC_AUTH_019: Từ chối login với non-string credentials');
  });

  /**
   * [TC_AUTH_020] Register với input không phải string
   */
  it('[TC_AUTH_020] should fail when registering with non-string fields', async () => {
    const invalidTypeData: any = {
      username: 12345,
      email: 'valid@example.com',
      password: 'password123',
      phone: '0901234567'
    };

    await expect(authService.register(invalidTypeData)).rejects.toThrow('Email, username và password phải là chuỗi');

    console.log('✅ TC_AUTH_020: Từ chối register với non-string fields');
  });

  /**
   * [TC_AUTH_021] (merged: invalid format + missing email + non-string email)
   * Mục tiêu: Forgot password validation
   */
  it('[TC_AUTH_021] should fail forgot password with invalid input', async () => {
    // Test invalid email format
    await expect(
      authService.forgotPassword({ email: 'invalid-email-format' })
    ).rejects.toThrow('Email không hợp lệ');

    // Test missing email
    await expect(
      authService.forgotPassword({ email: '' } as any)
    ).rejects.toThrow('Vui lòng nhập email');

    // Test non-string email
    await expect(
      authService.forgotPassword({ email: 12345 } as any)
    ).rejects.toThrow('Email phải là chuỗi');

    console.log('✅ TC_AUTH_021: Từ chối forgot password với invalid input');
  });

  /**
   * [TC_AUTH_022] (merged: refresh token edge cases - non-existent + inactive user)
   * Mục tiêu: Refresh token với các edge cases
   */
  it('[TC_AUTH_022] should fail refresh token for edge cases', async () => {
    // Test non-existent user
    const tempEmail1 = 'temp_refresh_' + Date.now() + '@example.com';
    const hashedPassword1 = await bcrypt.hash('password123', 10);
    const tempUser1 = await User.create({
      username: 'temp_refresh_user',
      email: tempEmail1,
      password_hash: hashedPassword1,
      phone: '0901111111',
      is_active: true
    });

    const loginResult1 = await authService.login({
      email: tempEmail1,
      password: 'password123'
    });

    await User.destroy({ where: { id: tempUser1.id } });

    await expect(
      authService.refreshToken(loginResult1.refreshToken)
    ).rejects.toThrow('Người dùng không tồn tại');

    // Test inactive user
    const tempEmail2 = 'temp_inactive_' + Date.now() + '@example.com';
    const hashedPassword2 = await bcrypt.hash('password123', 10);
    const tempUser2 = await User.create({
      username: 'temp_inactive_user',
      email: tempEmail2,
      password_hash: hashedPassword2,
      phone: '0902222222',
      is_active: true
    });
    createdUsers.push(tempUser2.id);

    const loginResult2 = await authService.login({
      email: tempEmail2,
      password: 'password123'
    });

    await User.update({ is_active: false }, { where: { id: tempUser2.id } });

    await expect(
      authService.refreshToken(loginResult2.refreshToken)
    ).rejects.toThrow('Tài khoản đã bị vô hiệu hóa');

    console.log('✅ TC_AUTH_022: Từ chối refresh token cho edge cases');
  });

  /**
   * [TC_AUTH_023] Change password với Google account
   */
  it('[TC_AUTH_023] should fail change password for Google account', async () => {
    const googleEmail = 'google_user_' + Date.now() + '@example.com';
    const googleUser = await User.create({
      username: 'google_user',
      email: googleEmail,
      password_hash: null,
      google_id: 'google_12345',
      phone: '0903333333',
      is_active: true
    });
    createdUsers.push(googleUser.id);

    await expect(
      authService.changePassword(googleUser.id, {
        current_password: 'anything',
        new_password: 'newpassword123'
      })
    ).rejects.toThrow('Tài khoản này không được sử dụng tính năng này vì tài khoản Google không có mật khẩu');

    console.log('✅ TC_AUTH_023: Từ chối change password cho Google account');
  });

  /**
   * [TC_AUTH_024] Update profile với email trùng chính nó (nên thành công)
   */
  it('[TC_AUTH_024] should alow update profile with same email', async () => {
    if (!createdUserId) {
      throw new Error('User chưa được tạo');
    }

    const dbUser = await User.findByPk(createdUserId);
    const currentEmail = dbUser?.email || '';

    const updateData: UpdateProfileDTO = {
      email: currentEmail,
      phone: '0907777777'
    };

    const result = await authService.updateProfile(createdUserId, updateData);

    expect(result).toBeDefined();
    expect(result.email).toBe(currentEmail);
    expect(result.phone).toBe('0907777777');

    console.log('✅ TC_AUTH_024: Cho phép update với email không đổi');
  });

  /**
   * [TC_AUTH_025] (merged: reset password all validations)
   * Mục tiêu: Reset password validation (fields, types, format, password length)
   */
  it('[TC_AUTH_025] should fail reset password with invalid input', async () => {
    // Test missing fields
    await expect(
      authService.resetPassword({
        email: testEmail,
        new_password: 'newpassword123',
        otp: ''
      })
    ).rejects.toThrow('Vui lòng nhập đầy đủ email, OTP và mật khẩu mới');

    // Test invalid types
    await expect(
      authService.resetPassword({
        email: 12345 as any,
        new_password: 'newpassword123',
        otp: '123456'
      })
    ).rejects.toThrow('Thông tin không hợp lệ');

    // Test invalid email format
    await expect(
      authService.resetPassword({
        email: 'invalid-email',
        new_password: 'newpassword123',
        otp: '123456'
      })
    ).rejects.toThrow('Email không hợp lệ');

    // Test short password
    await expect(
      authService.resetPassword({
        email: testEmail,
        new_password: '12345',
        otp: '123456'
      })
    ).rejects.toThrow('Mật khẩu phải có ít nhất 6 ký tự');

    console.log('✅ TC_AUTH_025: Từ chối reset password với invalid input');
  });

  /**
   * [TC_AUTH_026] Reset password - OTP không tồn tại
   */
  it('[TC_AUTH_026] should fail reset password with non-existent OTP', async () => {
    const emailWithoutOTP = 'no_otp_' + Date.now() + '@example.com';
    
    await expect(
      authService.resetPassword({
        email: emailWithoutOTP,
        new_password: 'newpassword123',
        otp: '123456'
      })
    ).rejects.toThrow('OTP không tồn tại. Vui lòng yêu cầu OTP mới');

    console.log('✅ TC_AUTH_026: Từ chối reset password với OTP không tồn tại');
  });

  /**
   * [TC_AUTH_027] Reset password - OTP sai
   */
  it('[TC_AUTH_027] should fail reset password with wrong OTP', async () => {
    // Request OTP
    await authService.forgotPassword({ email: testEmail });

    // Sai OTP
    await expect(
      authService.resetPassword({
        email: testEmail,
        new_password: 'newpassword123',
        otp: '999999' // OTP sai
      })
    ).rejects.toThrow('OTP không chính xác');

    console.log('✅ TC_AUTH_027: Từ chối reset password với OTP sai');
  });


  /**
   * [TC_AUTH_028] Forgot password với Google account
   */
  it('[TC_AUTH_044] should fail forgot password for Google account', async () => {
    const googleEmail = 'google_forgot_' + Date.now() + '@example.com';
    const googleUser = await User.create({
      username: 'google_forgot_user',
      email: googleEmail,
      password_hash: null,
      google_id: 'google_11111',
      phone: '0906666666',
      is_active: true
    });
    createdUsers.push(googleUser.id);

    await expect(
      authService.forgotPassword({ email: googleEmail })
    ).rejects.toThrow('Tài khoản này không được sử dụng tính năng này vì tài khoản Google không có mật khẩu');

    console.log('✅ TC_AUTH_028: Từ chối forgot password cho Google account');
  });

});
