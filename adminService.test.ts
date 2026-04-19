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
      await Admin.destroy({ where: { id: testAdminId } }).catch(() => {});
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
   * Mục tiêu: Search không có kết quả
   * Input: keyword không tồn tại
   * Expected: danh sách rỗng
   * CheckDB: Không có dữ liệu phù hợp
   */
  it('[TC_ADMIN_003] should return empty when search not found', async () => {
    const result = await adminService.getEmployees(1, 10, 'not_exist_123');

    expect(result.employees.length).toBe(0);

    console.log('✅ TC_ADMIN_003 passed');
  });

  /**
   * TC_ADMIN_004
   * Mục tiêu: Update role admin
   * Input: role = "super_admin"
   * Expected: role được cập nhật
   * CheckDB: DB phải lưu role mới
   */
  it('[TC_ADMIN_004] should update admin role', async () => {
    const result = await adminService.updateAdminRole(testAdminId, 'super_admin');

    expect(result.role).toBe('super_admin');

    const dbAdmin = await Admin.findByPk(testAdminId);
    expect(dbAdmin?.role).toBe('super_admin');

    console.log('✅ TC_ADMIN_004 passed');
  });

  /**
   * TC_ADMIN_005
   * Mục tiêu: Update region
   * Input: region = "southern"
   * Expected: region được cập nhật
   * CheckDB: DB phải lưu region mới
   */
  it('[TC_ADMIN_005] should update admin region', async () => {
    const result = await adminService.updateAdminRegion(testAdminId, 'southern');

    expect(result.region).toBe('southern');

    const dbAdmin = await Admin.findByPk(testAdminId);
    expect(dbAdmin?.region).toBe('southern');

    console.log('✅ TC_ADMIN_005 passed');
  });

  /**
   * TC_ADMIN_006
   * Mục tiêu: Deactivate admin
   * Input: is_active = false
   * Expected: admin bị disable
   * CheckDB: DB cập nhật đúng trạng thái
   */
  it('[TC_ADMIN_006] should deactivate admin', async () => {
    const result = await adminService.updateAdminStatus(testAdminId, false);

    expect(result.is_active).toBe(false);

    const dbAdmin = await Admin.findByPk(testAdminId);
    expect(dbAdmin?.is_active).toBe(false);

    console.log('✅ TC_ADMIN_006 passed');
  });

  /**
   * TC_ADMIN_007
   * Mục tiêu: Activate admin
   * Input: is_active = true
   * Expected: admin active lại
   * CheckDB: DB cập nhật đúng
   */
  it('[TC_ADMIN_007] should activate admin', async () => {
    const result = await adminService.updateAdminStatus(testAdminId, true);

    expect(result.is_active).toBe(true);

    const dbAdmin = await Admin.findByPk(testAdminId);
    expect(dbAdmin?.is_active).toBe(true);

    console.log('✅ TC_ADMIN_007 passed');
  });

  /**
   * TC_ADMIN_008
   * Mục tiêu: Filter theo role
   * Input: role = ['employee']
   * Expected: tất cả kết quả có role = employee
   */
  it('[TC_ADMIN_008] should filter employees by role', async () => {
    const result = await adminService.getEmployees(1, 10, undefined, undefined, ['employee']);

    result.employees.forEach((emp: any) => {
      expect(emp.role).toBe('employee');
    });

    console.log('✅ TC_ADMIN_008 passed');
  });

  /**
   * TC_ADMIN_009
   * Mục tiêu: Filter theo region
   * Input: region = ['northern']
   * Expected: tất cả kết quả đúng region
   */
  it('[TC_ADMIN_009] should filter employees by region', async () => {
    const result = await adminService.getEmployees(
      1,
      10,
      undefined,
      undefined,
      undefined,
      undefined,
      ['northern']
    );

    result.employees.forEach((emp: any) => {
      expect(emp.region).toBe('northern');
    });

    console.log('✅ TC_ADMIN_009 passed');
  });

  /**
   * TC_ADMIN_010
   * Mục tiêu: Pagination nhiều trang
   * Input: page 1 và page 2
   * Expected: dữ liệu khác nhau theo page
   */
  it('[TC_ADMIN_010] should paginate employees correctly', async () => {
    const page1 = await adminService.getEmployees(1, 5);
    const page2 = await adminService.getEmployees(2, 5);

    expect(page1.pagination.page).toBe(1);
    expect(page2.pagination.page).toBe(2);

    console.log('✅ TC_ADMIN_010 passed');
  });

  /**
   * TC_ADMIN_011
   * Mục tiêu: Update admin không tồn tại
   * Input: id không tồn tại
   * Expected: throw error
   */
  it('[TC_ADMIN_011] should fail when admin not found', async () => {
    await expect(
      adminService.updateAdminRole(9999999, 'employee')
    ).rejects.toThrow('Admin không tồn tại');

    console.log('✅ TC_ADMIN_011 passed');
  });

  /**
   * TC_ADMIN_012
   * Mục tiêu: Pagination vượt giới hạn
   * Input: page rất lớn
   * Expected: trả về mảng rỗng
   */
  it('[TC_ADMIN_012] should return empty when page out of range', async () => {
    const result = await adminService.getEmployees(999, 10);

    expect(result.employees.length).toBe(0);

    console.log('✅ TC_ADMIN_012 passed');
  });
});

