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
    console.log('🔐 Bắt đầu kiểm thử Admin Authentication...');
    testAdminEmail = 'admin_test_' + Date.now() + '@example.com';
  });

  /**
   * Rollback: Xóa toàn bộ dữ liệu test
   */
  afterAll(async () => {
    for (const adminId of createdAdminIds) {
      await Admin.destroy({ where: { id: adminId } }).catch(() => {});
    }
    console.log('✅ Rollback complete - DB đã về trạng thái ban đầu');
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
});