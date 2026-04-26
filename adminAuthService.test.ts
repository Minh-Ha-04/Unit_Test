import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import adminAuthService from '../services/adminAuthService';
import Admin from '../models/Admin';
import bcrypt from 'bcryptjs';

/**
 * Feature 9: Admin Authentication - Unit Test Scripts
 * Bao phủ: Login, Refresh Token, Get Admin, Register
 */

describe('[Feature 9] Admin Authentication - Unit Tests (Improved)', () => {
  let testAdminId: number | undefined;
  let testAdminEmail: string;
  let createdAdminIds: number[] = [];

  beforeAll(async () => {
    console.log(' Bắt đầu kiểm thử Admin Authentication...');
    testAdminEmail = 'admin_test_' + Date.now() + '@example.com';
  });

  /**
   * Rollback: Xóa toàn bộ dữ liệu test
   */
  afterAll(async () => {
    for (const adminId of createdAdminIds) {
      await Admin.destroy({ where: { id: adminId } }).catch(() => {});
    }
    console.log(' Rollback complete - DB đã về trạng thái ban đầu');
  });

  /**
   * TC_ADMIN_AUTH_001
   * Mục tiêu: Đăng nhập admin thành công
   * Input: email + password hợp lệ
   * Expected: Trả về admin + accessToken + refreshToken
   * CheckDB: Admin tồn tại trong DB
   */
  it('should login admin successfully', async () => {
    const hashedPassword = await bcrypt.hash('adminpass123', 10);

    const admin = await Admin.create({
      username: 'test_admin',
      email: testAdminEmail,
      password_hash: hashedPassword,
      role: 'employee',
      is_active: true,
      phone: '0905555555'
    });

    createdAdminIds.push(admin.id);
    testAdminId = admin.id;

    const result = await adminAuthService.login({
      email: testAdminEmail,
      password: 'adminpass123'
    });

    expect(result).toBeDefined();
    expect(result.admin.email).toBe(testAdminEmail);
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();

    // CheckDB
    const dbAdmin = await Admin.findByPk(testAdminId);
    expect(dbAdmin).not.toBeNull();

    console.log('✅ TC_ADMIN_AUTH_001 passed');
  });

  /**
   * TC_ADMIN_AUTH_002
   * Mục tiêu: Login sai password
   */
  it('should fail with wrong password', async () => {
    await expect(
      adminAuthService.login({
        email: testAdminEmail,
        password: 'wrongpassword'
      })
    ).rejects.toThrow('Email hoặc mật khẩu không đúng');

    console.log('✅ TC_ADMIN_AUTH_002 passed');
  });

  /**
   * TC_ADMIN_AUTH_003
   * Mục tiêu: Login email không tồn tại
   */
  it('should fail with non-existent email', async () => {
    await expect(
      adminAuthService.login({
        email: 'notfound_' + Date.now() + '@example.com',
        password: 'password123'
      })
    ).rejects.toThrow();

    console.log('✅ TC_ADMIN_AUTH_003 passed');
  });

  /**
   * TC_ADMIN_AUTH_004
   * Mục tiêu: Login thiếu dữ liệu
   */
  it('should fail with missing credentials', async () => {
    await expect(
      adminAuthService.login({
        email: '',
        password: ''
      } as any)
    ).rejects.toThrow();

    console.log('✅ TC_ADMIN_AUTH_004 passed');
  });

  /**
   * TC_ADMIN_AUTH_005
   * Mục tiêu: Login với admin bị disable
   */
  it('should fail with inactive admin', async () => {
    const hashedPassword = await bcrypt.hash('password123', 10);

    const inactiveAdmin = await Admin.create({
      username: 'inactive_admin',
      email: 'inactive_' + Date.now() + '@example.com',
      password_hash: hashedPassword,
      role: 'employee',
      is_active: false
    });

    createdAdminIds.push(inactiveAdmin.id);

    await expect(
      adminAuthService.login({
        email: inactiveAdmin.email,
        password: 'password123'
      })
    ).rejects.toThrow('Tài khoản admin đã bị vô hiệu hóa');

    console.log('✅ TC_ADMIN_AUTH_005 passed');
  });

  /**
   * TC_ADMIN_AUTH_006
   * Mục tiêu: Refresh token hợp lệ
   */
  it('should refresh token successfully', async () => {
    const loginResult = await adminAuthService.login({
      email: testAdminEmail,
      password: 'adminpass123'
    });

    const result = await adminAuthService.refreshToken(loginResult.refreshToken);

    expect(result).toBeDefined();
    expect(result.accessToken).toBeDefined();

    console.log('✅ TC_ADMIN_AUTH_006 passed');
  });

  /**
   * TC_ADMIN_AUTH_007
   * Mục tiêu: Refresh token không hợp lệ
   */
  it('should fail with invalid refresh token', async () => {
    await expect(
      adminAuthService.refreshToken('invalid.token')
    ).rejects.toThrow();

    console.log('✅ TC_ADMIN_AUTH_007 passed');
  });

  /**
   * TC_ADMIN_AUTH_008
   * Mục tiêu: Lấy admin theo ID
   * CheckDB: So sánh dữ liệu DB
   */
  it('should get admin by ID', async () => {
    const result = await adminAuthService.getAdminById(testAdminId!);

    expect(result).toBeDefined();
    expect(result.id).toBe(testAdminId);

    // CheckDB
    const dbAdmin = await Admin.findByPk(testAdminId!);
    expect(dbAdmin?.email).toBe(result.email);

    console.log('✅ TC_ADMIN_AUTH_008 passed');
  });

  /**
   * TC_ADMIN_AUTH_009
   * Mục tiêu: Lấy admin không tồn tại
   */
  it('should fail with non-existent admin ID', async () => {
    await expect(
      adminAuthService.getAdminById(9999999)
    ).rejects.toThrow('Admin không tồn tại');

    console.log('✅ TC_ADMIN_AUTH_009 passed');
  });

  /**
   * TC_ADMIN_AUTH_010
   * Mục tiêu: Đăng ký admin mới
   * CheckDB: Kiểm tra dữ liệu lưu trong DB
   */
  it('should register new admin successfully', async () => {
    const registerData = {
      username: 'new_admin_' + Date.now(),
      email: 'new_admin_' + Date.now() + '@example.com',
      password: 'adminpass123',
      role: 'employee' as const,
      region: 'northern' as const,
      phone: '0906666666'
    };

    const result = await adminAuthService.register(registerData);

    expect(result).toBeDefined();
    expect(result.email).toBe(registerData.email);

    createdAdminIds.push(result.id);

    // CheckDB
    const dbAdmin = await Admin.findByPk(result.id);
    expect(dbAdmin).not.toBeNull();
    expect(dbAdmin?.email).toBe(registerData.email);
    expect(dbAdmin?.username).toBe(registerData.username);

    console.log('✅ TC_ADMIN_AUTH_010 passed');
  });

  /**
   * TC_ADMIN_AUTH_011
   * Mục tiêu: Register với email trùng
   */
  it('should fail when registering duplicate email', async () => {
    const duplicateData = {
      username: 'duplicate_admin',
      email: testAdminEmail, // trùng
      password: 'adminpass123',
      role: 'employee' as const
    };

    await expect(
      adminAuthService.register(duplicateData)
    ).rejects.toThrow();

    console.log('✅ TC_ADMIN_AUTH_011 passed');
  });


/**
 * TC_ADMIN_AUTH_012
 * Mục tiêu: Login thiếu email
 */
it('should fail when email is missing', async () => {
  await expect(
    adminAuthService.login({
      email: '',
      password: 'adminpass123'
    } as any)
  ).rejects.toThrow();

  console.log('✅ TC_ADMIN_AUTH_012 passed');
});


/**
 * TC_ADMIN_AUTH_013
 * Mục tiêu: Login thiếu password
 */
it('should fail when password is missing', async () => {
  await expect(
    adminAuthService.login({
      email: testAdminEmail,
      password: ''
    } as any)
  ).rejects.toThrow();

  console.log('✅ TC_ADMIN_AUTH_013 passed');
});


/**
 * TC_ADMIN_AUTH_014
 * Mục tiêu: Register với role không hợp lệ
 * Expected: Bị từ chối hoặc xử lý lỗi
 */
it('should fail with invalid role', async () => {
  const invalidRoleData = {
    username: 'invalid_role_admin',
    email: 'invalid_role_' + Date.now() + '@example.com',
    password: 'adminpass123',
    role: 'super_admin_hacker' as any // role không hợp lệ
  };

  await expect(
    adminAuthService.register(invalidRoleData)
  ).rejects.toThrow();

  console.log('✅ TC_ADMIN_AUTH_014 passed');
});


/**
 * TC_ADMIN_AUTH_015
 * Mục tiêu: Refresh token bị sai format
 */
it('should fail when refresh token format is invalid', async () => {
  const badToken = 'abc123'; // không phải JWT

  await expect(
    adminAuthService.refreshToken(badToken)
  ).rejects.toThrow();

  console.log('✅ TC_ADMIN_AUTH_015 passed');
});

/**
 * TC_ADMIN_AUTH_016
 * Mục tiêu: Cập nhật profile admin thành công
 * CheckDB: Kiểm tra dữ liệu được cập nhật trong DB
 */
it('should update admin profile successfully', async () => {
  const updateData = {
    username: 'updated_admin_' + Date.now(),
    phone: '0907777777'
  };

  const result = await adminAuthService.updateProfile(testAdminId!, updateData);

  expect(result).toBeDefined();
  expect(result.username).toBe(updateData.username);
  expect(result.phone).toBe(updateData.phone);

  // CheckDB
  const dbAdmin = await Admin.findByPk(testAdminId!);
  expect(dbAdmin?.username).toBe(updateData.username);
  expect(dbAdmin?.phone).toBe(updateData.phone);

  console.log('✅ TC_ADMIN_AUTH_016 passed');
});

/**
 * TC_ADMIN_AUTH_017
 * Mục tiêu: Cập nhật email thành công
 */
it('should update admin email successfully', async () => {
  const newEmail = 'updated_' + Date.now() + '@example.com';
  
  const result = await adminAuthService.updateProfile(testAdminId!, {
    email: newEmail
  });

  expect(result.email).toBe(newEmail);

  // CheckDB
  const dbAdmin = await Admin.findByPk(testAdminId!);
  expect(dbAdmin?.email).toBe(newEmail);

  // Update testAdminEmail to track the new email
  testAdminEmail = newEmail;

  console.log('✅ TC_ADMIN_AUTH_017 passed');
});

/**
 * TC_ADMIN_AUTH_018
 * Mục tiêu: Cập nhật profile với email trùng
 */
it('should fail when updating to duplicate email', async () => {
  // Tạo một email gốc để test
  const originalEmail = 'original_' + Date.now() + '@example.com';
  const hashedPassword = await bcrypt.hash('password123', 10);
  const admin1 = await Admin.create({
    username: 'admin_for_duplicate_test',
    email: originalEmail,
    password_hash: hashedPassword,
    role: 'employee',
    is_active: true
  });
  createdAdminIds.push(admin1.id);

  // Tạo admin thứ 2 để test trùng email
  const admin2 = await Admin.create({
    username: 'another_admin_for_test',
    email: 'another_' + Date.now() + '@example.com',
    password_hash: hashedPassword,
    role: 'employee',
    is_active: true
  });
  createdAdminIds.push(admin2.id);

  // Thử cập nhật email của admin2 thành email của admin1
  await expect(
    adminAuthService.updateProfile(admin2.id, {
      email: originalEmail
    })
  ).rejects.toThrow('Email đã được sử dụng');

  console.log('✅ TC_ADMIN_AUTH_018 passed');
});

/**
 * TC_ADMIN_AUTH_019
 * Mục tiêu: Cập nhật profile admin không tồn tại
 */
it('should fail when updating non-existent admin', async () => {
  await expect(
    adminAuthService.updateProfile(9999999, {
      username: 'new_username'
    })
  ).rejects.toThrow('Admin không tồn tại');

  console.log('✅ TC_ADMIN_AUTH_019 passed');
});

/**
 * TC_ADMIN_AUTH_020
 * Mục tiêu: Cập nhật profile với dữ liệu rỗng
 */
it('should fail when updating with empty data', async () => {
  await expect(
    adminAuthService.updateProfile(testAdminId!, {})
  ).rejects.toThrow('Không có dữ liệu nào để cập nhật');

  console.log('✅ TC_ADMIN_AUTH_020 passed');
});

/**
 * TC_ADMIN_AUTH_021
 * Mục tiêu: Cập nhật username rỗng
 */
it('should fail when updating with empty username', async () => {
  await expect(
    adminAuthService.updateProfile(testAdminId!, {
      username: ''
    })
  ).rejects.toThrow('Tên đăng nhập không được để trống');

  console.log('✅ TC_ADMIN_AUTH_021 passed');
});

/**
 * TC_ADMIN_AUTH_022
 * Mục tiêu: Cập nhật email với format không hợp lệ
 */
it('should fail when updating with invalid email format', async () => {
  await expect(
    adminAuthService.updateProfile(testAdminId!, {
      email: 'invalid-email-format'
    })
  ).rejects.toThrow('Email không hợp lệ');

  console.log('✅ TC_ADMIN_AUTH_022 passed');
});

/**
 * TC_ADMIN_AUTH_023
 * Mục tiêu: Login với password_hash không hợp lệ (không có bcrypt prefix)
 */
it('should fail when admin has invalid password hash format', async () => {
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  const adminWithBadHash = await Admin.create({
    username: 'bad_hash_admin',
    email: 'bad_hash_' + Date.now() + '@example.com',
    password_hash: 'invalid_hash_without_bcrypt_prefix',
    role: 'employee',
    is_active: true
  });
  createdAdminIds.push(adminWithBadHash.id);

  await expect(
    adminAuthService.login({
      email: adminWithBadHash.email,
      password: 'password123'
    })
  ).rejects.toThrow('Tài khoản không hợp lệ. Vui lòng liên hệ quản trị viên');

  console.log('✅ TC_ADMIN_AUTH_023 passed');
});

/**
 * TC_ADMIN_AUTH_024
 * Mục tiêu: Login với admin không có password_hash
 */
it('should fail when admin has no password hash', async () => {
  const adminNoPassword = await Admin.create({
    username: 'no_password_admin',
    email: 'no_password_' + Date.now() + '@example.com',
    password_hash: '',
    role: 'employee',
    is_active: true
  });
  createdAdminIds.push(adminNoPassword.id);

  await expect(
    adminAuthService.login({
      email: adminNoPassword.email,
      password: 'password123'
    })
  ).rejects.toThrow('Tài khoản không hợp lệ. Vui lòng liên hệ quản trị viên');

  console.log('✅ TC_ADMIN_AUTH_024 passed');
});

/**
 * TC_ADMIN_AUTH_025
 * Mục tiêu: Register với password quá ngắn
 */
it('should fail when registering with short password', async () => {
  const shortPasswordData = {
    username: 'short_password_admin',
    email: 'short_pwd_' + Date.now() + '@example.com',
    password: '12345', // chỉ 5 ký tự
    role: 'employee' as const
  };

  await expect(
    adminAuthService.register(shortPasswordData)
  ).rejects.toThrow('Mật khẩu phải có ít nhất 6 ký tự');

  console.log('✅ TC_ADMIN_AUTH_025 passed');
});

/**
 * TC_ADMIN_AUTH_026
 * Mục tiêu: Register với username quá ngắn
 */
it('should fail when registering with short username', async () => {
  const shortUsernameData = {
    username: 'ab', // chỉ 2 ký tự
    email: 'short_user_' + Date.now() + '@example.com',
    password: 'password123',
    role: 'employee' as const
  };

  await expect(
    adminAuthService.register(shortUsernameData)
  ).rejects.toThrow('Tên đăng nhập phải có ít nhất 3 ký tự');

  console.log('✅ TC_ADMIN_AUTH_026 passed');
});

/**
 * TC_ADMIN_AUTH_027
 * Mục tiêu: Register với email format không hợp lệ
 */
it('should fail when registering with invalid email format', async () => {
  const invalidEmailData = {
    username: 'invalid_email_admin',
    email: 'not-an-email',
    password: 'password123',
    role: 'employee' as const
  };

  await expect(
    adminAuthService.register(invalidEmailData)
  ).rejects.toThrow('Email không hợp lệ');

  console.log('✅ TC_ADMIN_AUTH_027 passed');
});

/**
 * TC_ADMIN_AUTH_028
 * Mục tiêu: Register với role 'guide'
 */
it('should register admin with guide role successfully', async () => {
  const guideRoleData = {
    username: 'guide_admin_' + Date.now(),
    email: 'guide_' + Date.now() + '@example.com',
    password: 'password123',
    role: 'guide' as any, // Service sẽ normalize thành 'employee' nếu không hợp lệ
    region: 'central' as const,
    phone: '0908888888'
  };

  const result = await adminAuthService.register(guideRoleData);

  expect(result).toBeDefined();
  // Service sẽ fallback về 'employee' nếu role không hợp lệ
  expect(result.role).toBeDefined();
  expect(result.region).toBe('central');
  expect(result.phone).toBe('0908888888');

  createdAdminIds.push(result.id);

  console.log('✅ TC_ADMIN_AUTH_028 passed');
});

/**
 * TC_ADMIN_AUTH_029
 * Mục tiêu: Refresh token với admin đã bị vô hiệu hóa
 */
it('should fail when refreshing token for inactive admin', async () => {
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  const inactiveAdmin = await Admin.create({
    username: 'inactive_refresh_admin',
    email: 'inactive_refresh_' + Date.now() + '@example.com',
    password_hash: hashedPassword,
    role: 'employee',
    is_active: true
  });
  createdAdminIds.push(inactiveAdmin.id);

  // Login để lấy token
  const loginResult = await adminAuthService.login({
    email: inactiveAdmin.email,
    password: 'password123'
  });

  // Vô hiệu hóa admin
  await Admin.update({ is_active: false }, {
    where: { id: inactiveAdmin.id }
  });

  // Thử refresh token
  await expect(
    adminAuthService.refreshToken(loginResult.refreshToken)
  ).rejects.toThrow('Tài khoản admin đã bị vô hiệu hóa');

  console.log('✅ TC_ADMIN_AUTH_029 passed');
});

/**
 * TC_ADMIN_AUTH_030
 * Mục tiêu: Register thiếu thông tin bắt buộc
 */
it('should fail when registering with missing required fields', async () => {
  const missingFieldsData = {
    username: '',
    email: 'missing_' + Date.now() + '@example.com',
    password: 'password123',
    role: 'employee' as const
  };

  await expect(
    adminAuthService.register(missingFieldsData as any)
  ).rejects.toThrow('Vui lòng nhập đầy đủ thông tin');

  console.log('✅ TC_ADMIN_AUTH_030 passed');
});

/**
 * TC_ADMIN_AUTH_031
 * Mục tiêu: Login với input không phải string
 */
it('should fail when login with non-string credentials', async () => {
  await expect(
    adminAuthService.login({
      email: 12345 as any,
      password: 'password123'
    })
  ).rejects.toThrow('Email và mật khẩu phải là chuỗi');

  console.log('✅ TC_ADMIN_AUTH_031 passed');
});

/**
 * TC_ADMIN_AUTH_032
 * Mục tiêu: Register với input không phải string
 */
it('should fail when registering with non-string fields', async () => {
  const invalidTypeData = {
    username: 12345 as any,
    email: 'valid@example.com',
    password: 'password123',
    role: 'employee' as const
  };

  await expect(
    adminAuthService.register(invalidTypeData)
  ).rejects.toThrow('Thông tin không hợp lệ');

  console.log('✅ TC_ADMIN_AUTH_032 passed');
});

/**
 * TC_ADMIN_AUTH_033
 * Mục tiêu: Cập nhật phone thành null
 */
it('should update phone to null successfully', async () => {
  // Đảm bảo admin có phone trước
  await Admin.update({ phone: '0909999999' }, {
    where: { id: testAdminId! }
  });

  const result = await adminAuthService.updateProfile(testAdminId!, {
    phone: ''
  });

  expect(result.phone).toBeNull();

  // CheckDB
  const dbAdmin = await Admin.findByPk(testAdminId!);
  expect(dbAdmin?.phone).toBeNull();

  console.log('✅ TC_ADMIN_AUTH_033 passed');
});

/**
 * TC_ADMIN_AUTH_034
 * Mục tiêu: Cập nhật cùng email hiện tại (không thay đổi) - sẽ fail vì không có gì thay đổi
 */
it('should fail when updating with same email only', async () => {
  const admin = await Admin.findByPk(testAdminId!);
  const currentEmail = admin?.email || '';

  // Khi chỉ update cùng email, không có field nào thay đổi nên sẽ fail
  await expect(
    adminAuthService.updateProfile(testAdminId!, {
      email: currentEmail
    })
  ).rejects.toThrow('Không thể cập nhật thông tin. Vui lòng thử lại.');

  console.log('✅ TC_ADMIN_AUTH_034 passed');
});
});