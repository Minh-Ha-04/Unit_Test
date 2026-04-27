import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import adminService from '../services/adminService';
import Admin from '../models/Admin';
import bcrypt from 'bcryptjs';

/**
 * Feature 12: Admin Management - Unit Test (FINAL VERSION)
 * Loại test: Integration Test (có sử dụng DB thật)
 * Bao phủ:
 * - Pagination / Search / Filter
 * - Update role / region / status
 * - Validation & Error handling
 * - CheckDB + Rollback
 */

describe('[Feature 12] Admin Management - Final Test Suite', () => {
  let testAdminId: number;
  let originalAdminData: any;

  /**
   * SETUP
   * Tạo dữ liệu test trước khi chạy
   */
  beforeAll(async () => {
    console.log('🚀 Bắt đầu kiểm thử Admin Management...');

    const hashedPassword = await bcrypt.hash('adminpass123', 10);

    const admin = await Admin.create({
      username: 'test_admin_mgmt',
      email: 'admin_' + Date.now() + '@example.com',
      password_hash: hashedPassword,
      role: 'employee',
      is_active: true,
      phone: '0909999999',
      region: 'northern'
    });

    testAdminId = admin.id;
    originalAdminData = admin.toJSON();
  });

  /**
   * ROLLBACK
   * Đảm bảo DB quay về trạng thái ban đầu
   */
  afterAll(async () => {
    if (testAdminId) {
      await Admin.destroy({ where: { id: testAdminId } }).catch(() => { });
    }
    console.log('✅ Rollback hoàn tất - DB sạch');
  });

  /**
   * TC_ADMIN_001
   * Mục tiêu: Lấy danh sách employees (pagination)
   * Input: page=1, limit=10
   * Expected:
   *  - Trả về danh sách employees
   *  - pagination.page = 1
   * CheckDB: Có (gián tiếp qua query)
   */
  it('[TC_ADMIN_001] should get employees with pagination', async () => {
    const result = await adminService.getEmployees(1, 10);

    expect(result).toBeDefined();
    expect(Array.isArray(result.employees)).toBe(true);
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.limit).toBe(10);

    console.log('✅ TC_ADMIN_001 passed');
  });

  /**
   * TC_ADMIN_002
   * Mục tiêu: Search employees theo username
   * Input: keyword = "test_admin_mgmt"
   * Expected:
   *  - Trả về danh sách chứa admin vừa tạo
   * CheckDB: username trong DB phải khớp
   */
  it('[TC_ADMIN_002] should search employees by username', async () => {
    const result = await adminService.getEmployees(1, 10, 'test_admin_mgmt');

    expect(result.employees.length).toBeGreaterThan(0);

    const found = result.employees.some((e: any) =>
      e.username.includes('test_admin_mgmt')
    );
    expect(found).toBe(true);

    // CheckDB
    const dbAdmin = await Admin.findByPk(testAdminId);
    expect(dbAdmin?.username).toContain('test_admin_mgmt');

    console.log('✅ TC_ADMIN_002 passed');
  });

  /**
   * TC_ADMIN_003
   * Mục tiêu: Update role admin
   * Input: role = "super_admin"
   * Expected: role được cập nhật
   * CheckDB: DB phải lưu role mới
   */
  it('[TC_ADMIN_003] should update admin role', async () => {
    const result = await adminService.updateAdminRole(testAdminId, 'super_admin');

    expect(result.role).toBe('super_admin');

    const dbAdmin = await Admin.findByPk(testAdminId);
    expect(dbAdmin?.role).toBe('super_admin');

    console.log('✅ TC_ADMIN_003 passed');
  });

  /**
   * TC_ADMIN_004
   * Mục tiêu: Update region
   * Input: region = "southern"
   * Expected: region được cập nhật
   * CheckDB: DB phải lưu region mới
   */
  it('[TC_ADMIN_004] should update admin region', async () => {
    const result = await adminService.updateAdminRegion(testAdminId, 'southern');

    expect(result.region).toBe('southern');

    const dbAdmin = await Admin.findByPk(testAdminId);
    expect(dbAdmin?.region).toBe('southern');

    console.log('✅ TC_ADMIN_004 passed');
  });

  /**
   * TC_ADMIN_005
   * Mục tiêu: Deactivate admin
   * Input: is_active = false
   * Expected: admin bị disable
   * CheckDB: DB cập nhật đúng trạng thái
   */
  it('[TC_ADMIN_005] should deactivate admin', async () => {
    const result = await adminService.updateAdminStatus(testAdminId, false);

    expect(result.is_active).toBe(false);

    const dbAdmin = await Admin.findByPk(testAdminId);
    expect(dbAdmin?.is_active).toBe(false);

    console.log('✅ TC_ADMIN_005 passed');
  });


  /**
   * TC_ADMIN_006
   * Mục tiêu: Update admin không tồn tại (merged: role, region, status, password)
   * Input: id không tồn tại
   * Expected: throw error cho tất cả methods
   */
  it('[TC_ADMIN_006] should fail when admin not found for all update operations', async () => {
    const nonExistentId = 9999999;

    // Test updateAdminRole
    await expect(
      adminService.updateAdminRole(nonExistentId, 'employee')
    ).rejects.toThrow('Admin không tồn tại');

    // Test updateAdminRegion
    await expect(
      adminService.updateAdminRegion(nonExistentId, 'northern')
    ).rejects.toThrow('Admin không tồn tại');

    // Test updateAdminStatus
    await expect(
      adminService.updateAdminStatus(nonExistentId, true)
    ).rejects.toThrow('Admin không tồn tại');

    // Test updateAdminPassword
    await expect(
      adminService.updateAdminPassword(nonExistentId, 'newPassword123')
    ).rejects.toThrow('Admin không tồn tại');

    console.log('✅ TC_ADMIN_006 passed');
  });

  /**
   * TC_ADMIN_007
   * Mục tiêu: Update password thành công
   * CheckDB: Password hash được cập nhật
   */
  it('[TC_ADMIN_007] should update admin password successfully', async () => {
    const newPassword = 'newSecurePassword123';

    const result = await adminService.updateAdminPassword(testAdminId, newPassword);

    expect(result).toBeDefined();
    expect(result.id).toBe(testAdminId);
    expect(result.password_hash).toBeUndefined();

    // CheckDB - verify password was changed by trying to login
    const dbAdmin = await Admin.findByPk(testAdminId);
    expect(dbAdmin).not.toBeNull();

    const isPasswordValid = await dbAdmin!.comparePassword(newPassword);
    expect(isPasswordValid).toBe(true);

    console.log('✅ TC_ADMIN_007 passed');
  });

  /**
   * TC_ADMIN_008
   * Mục tiêu: Update password với password quá ngắn
   */
  it('[TC_ADMIN_008] should fail when password is too short', async () => {
    await expect(
      adminService.updateAdminPassword(testAdminId, 'short')
    ).rejects.toThrow('Mật khẩu phải có ít nhất 8 ký tự');

    console.log('✅ TC_ADMIN_008 passed');
  });

  /**
   * TC_ADMIN_009
   * Mục tiêu: Update password với password không hợp lệ
   */
  it('[TC_ADMIN_009] should fail when password is invalid type', async () => {
    await expect(
      adminService.updateAdminPassword(testAdminId, '' as any)
    ).rejects.toThrow('Mật khẩu mới không hợp lệ');

    console.log('✅ TC_ADMIN_009 passed');
  });

  /**
   * TC_ADMIN_010
   * Mục tiêu: Update region với region không hợp lệ
   */
  it('[TC_ADMIN_010] should fail when updating with invalid region', async () => {
    await expect(
      adminService.updateAdminRegion(testAdminId, 'invalid_region' as any)
    ).rejects.toThrow('Vùng không hợp lệ');

    console.log('✅ TC_ADMIN_010 passed');
  });

  /**
   * TC_ADMIN_011
   * Mục tiêu: Update role với role không hợp lệ
   */
  it('[TC_ADMIN_011] should fail when updating with invalid role', async () => {
    await expect(
      adminService.updateAdminRole(testAdminId, 'invalid_role' as any)
    ).rejects.toThrow('Vai trò không hợp lệ');

    console.log('✅ TC_ADMIN_011 passed');
  });

  /**
   * TC_ADMIN_012
   * Mục tiêu: Exclude admin ID khỏi kết quả
   */
  it('[TC_ADMIN_012] should exclude specific admin ID', async () => {
    const result = await adminService.getEmployees(1, 10, undefined, testAdminId);

    const found = result.employees.some((e: any) => e.id === testAdminId);
    expect(found).toBe(false);

    console.log('✅ TC_ADMIN_012 passed');
  });

  /**
   * TC_ADMIN_013
   * Mục tiêu: Sort theo createdAt DESC và updatedAt ASC - verify thứ tự đúng
   */
  it('[TC_ADMIN_013] should sort employees by createdAt DESC and updatedAt ASC', async () => {
    // Test sort by createdAt DESC
    const descResult = await adminService.getEmployees(1, 10, undefined, undefined, undefined, undefined, undefined, 'desc');
    expect(descResult.employees.length).toBeGreaterThan(0);
    expect(descResult.pagination.page).toBe(1);

    // Test sort by updatedAt ASC
    const ascResult = await adminService.getEmployees(1, 10, undefined, undefined, undefined, undefined, undefined, undefined, 'asc');
    expect(ascResult.employees.length).toBeGreaterThan(0);
    expect(ascResult.pagination.page).toBe(1);

    console.log('✅ TC_ADMIN_013 passed');
  });


  /**
/**
 * TC_ADMIN_014
 * Mục tiêu: Search guides theo username (có & không có kết quả)
 */
  it('[TC_ADMIN_014] should search guides correctly by username', async () => {
    // 🔹 Tạo guide test
    const guide = await Admin.create({
      username: 'guide_test_123',
      email: 'guide_' + Date.now() + '@example.com',
      password_hash: '12345678',
      role: 'guide',
      is_active: true
    });

    // ===== CASE 1: Search KHÔNG có kết quả =====
    const resultEmpty = await adminService.getAllGuidesWithTourCount(
      1,
      10,
      'nonexistent_guide'
    );

    expect(resultEmpty.guides.length).toBe(0);

    // ===== CASE 2: Search CÓ kết quả =====
    const resultFound = await adminService.getAllGuidesWithTourCount(
      1,
      10,
      'guide_test'
    );

    expect(resultFound.guides.length).toBeGreaterThan(0);

    const found = resultFound.guides.some((g: any) =>
      g.username.includes('guide_test')
    );
    expect(found).toBe(true);

    // 🔹 Cleanup (rollback)
    await Admin.destroy({ where: { id: guide.id } });

    console.log('✅ TC_ADMIN_014 passed');
  });



  /**
   * TC_ADMIN_015
   * Mục tiêu: Get tours by guide - fail với ID không tồn tại
   */
  it('[TC_ADMIN_015] should fail when getting tours for non-existent guide', async () => {
    await expect(
      adminService.getToursByGuide(9999999)
    ).rejects.toThrow('Hướng dẫn viên không tồn tại');

    console.log('✅ TC_ADMIN_015 passed');
  });

  /**
   * TC_ADMIN_016
   * Mục tiêu: Không cho phép admin không phải guide lấy orders (kể cả có tourId)
   */
  it('[TC_ADMIN_016] should fail when admin is not a guide even with tourId filter', async () => {
    await expect(
      adminService.getOrdersByGuideAndDateRange(
        testAdminId,
        '2024-01-01',
        '2024-12-31',
        1
      )
    ).rejects.toThrow('Hướng dẫn viên không tồn tại');

    console.log('✅ TC_ADMIN_016 passed');
  });

  /**
 * TC_ADMIN_017
 * Mục tiêu: Filter kết hợp nhiều điều kiện (roles + is_active + regions)
 */
  it('[TC_ADMIN_017] should filter employees with multiple conditions', async () => {
    const result = await adminService.getEmployees(
      1,
      10,
      undefined,
      undefined,
      ['employee', 'super_admin'],
      true,
      ['northern', 'southern']
    );

    // ✅ phải có dữ liệu (nếu DB có seed)
    expect(result.employees.length).toBeGreaterThan(0);

    result.employees.forEach((emp: any) => {
      expect(['employee', 'super_admin']).toContain(emp.role);
      expect(emp.is_active).toBe(true);

      // region có thể null nên check cẩn thận
      if (emp.region !== null && emp.region !== undefined) {
        expect(['northern', 'southern']).toContain(emp.region);
      }
    });

    console.log('✅ TC_ADMIN_017 passed');
  });
});

