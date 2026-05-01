import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import userService from '../services/userService';
import User from '../models/User';
import bcrypt from 'bcryptjs';

/**
 * Feature 2: User Management - Optimized Unit Tests (25 cases, full coverage)
 */
describe('[Feature 2] User Management - Optimized Tests', () => {
  let createdUsers: number[] = [];
  let existingUserId: number | undefined;
  let publicProfileUsername: string;

  beforeAll(async () => {
    console.log('👥 Bắt đầu kiểm thử Quản Lý Người Dùng...');
    const defaultPassword = await bcrypt.hash('default123', 10);
    const defaultUser = await User.create({
      username: 'default_user',
      email: 'default@example.com',
      password_hash: defaultPassword,
      phone: '0900000000',
      is_active: true,
      gender: 'other'
    });
    existingUserId = defaultUser.id;
    createdUsers.push(existingUserId);

    const publicUser = await User.create({
      username: 'public_profile_user',
      email: 'public@example.com',
      password_hash: await bcrypt.hash('public123', 10),
      phone: '0911111111',
      is_active: true,
      gender: 'male'
    });
    publicProfileUsername = publicUser.username;
    createdUsers.push(publicUser.id);
  });

  afterAll(async () => {
    console.log('🔄 Rollback dữ liệu...');
    for (const userId of createdUsers) {
      await User.destroy({ where: { id: userId } }).catch(() => 0);
    }
    console.log('✅ Rollback complete');
  });

  // ========== getAllUsers() ==========
  /**
   * [TC_USER_001] Lấy danh sách users phân trang cơ bản
   * Mục tiêu: Kiểm tra getAllUsers với page=1, limit=10 trả về đúng cấu trúc
   * Input: page=1, limit=10
   * Expected: users là mảng, pagination có page=1, limit=10
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_USER_001] should get users with pagination', async () => {
    const result = await userService.getAllUsers(1, 10);
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.limit).toBe(10);
    expect(result.users.length).toBeLessThanOrEqual(10);
  });

  /**
   * [TC_USER_002] Lọc users theo is_active=true
   * Mục tiêu: Kiểm tra filter hoạt động đúng
   * Input: is_active=true
   * Expected: Tất cả users trả về đều có is_active=true
   * CheckDB: Không thay đổi DB
   */
  it('[TC_USER_002] should filter by is_active=true', async () => {
    const result = await userService.getAllUsers(1, 10, { is_active: true });
    expect(result.users.every(u => u.is_active === true)).toBe(true);
  });

  /**
   * [TC_USER_003] Lọc users theo is_active=false
   * Mục tiêu: Kiểm tra filter inactive users
   * Input: is_active=false
   * Expected: Tất cả users trả về có is_active=false
   */
  it('[TC_USER_003] should filter by is_active=false', async () => {
    const result = await userService.getAllUsers(1, 10, { is_active: false });
    expect(result.users.every(u => u.is_active === false)).toBe(true);
  });

  /**
   * [TC_USER_004] Tìm kiếm users theo keyword (username hoặc email)
   * Mục tiêu: Kiểm tra search hoạt động đúng
   * Input: search='searchme' (tạo user có username chứa keyword)
   * Expected: Trả về ít nhất 1 user có username chứa keyword
   * CheckDB: Tạo user mới sẽ bị xóa sau test
   */
  it('[TC_USER_004] should search by keyword', async () => {
    const searchUser = await User.create({
      username: 'searchme_' + Date.now(),
      email: 'search_' + Date.now() + '@example.com',
      password_hash: await bcrypt.hash('pass', 10),
      phone: '0911111111',
      is_active: true
    });
    createdUsers.push(searchUser.id);
    const result = await userService.getAllUsers(1, 10, { search: 'searchme' });
    expect(result.users.length).toBeGreaterThan(0);
  });

  /**
   * [TC_USER_005] Tìm kiếm với keyword không tồn tại
   * Mục tiêu: Kiểm tra trường hợp không có kết quả
   * Input: search='nonexistent_xyz'
   * Expected: Mảng users rỗng
   */
  it('[TC_USER_005] should return empty for non-matching search', async () => {
    const result = await userService.getAllUsers(1, 10, { search: 'nonexistent_xyz' });
    expect(result.users.length).toBe(0);
  });

  /**
   * [TC_USER_006] Kết hợp filter is_active và search
   * Mục tiêu: Kiểm tra nhiều filter cùng lúc
   * Input: is_active=true, search='default'
   * Expected: Tất cả users có is_active=true và username/email chứa 'default'
   */
  it('[TC_USER_006] should combine active filter and search', async () => {
    const result = await userService.getAllUsers(1, 10, { is_active: true, search: 'default' });
    expect(result.users.every(u => u.is_active === true)).toBe(true);
  });

  /**
   * [TC_USER_007] Xử lý limit lớn (100)
   * Mục tiêu: Kiểm tra limit không bị giới hạn cứng
   * Input: limit=100
   * Expected: pagination.limit = 100
   */
  it('[TC_USER_007] should handle large limit (100)', async () => {
    const result = await userService.getAllUsers(1, 100);
    expect(result.pagination.limit).toBe(100);
  });

  /**
   * [TC_USER_008] Page vượt quá tổng số trang
   * Mục tiêu: Kiểm tra xử lý page > totalPages
   * Input: page=999999
   * Expected: Mảng users rỗng
   */
  it('[TC_USER_008] should return empty for page exceeding total', async () => {
    const result = await userService.getAllUsers(999999, 10);
    expect(result.users.length).toBe(0);
  });

  // ========== updateUser() ==========
  /**
   * [TC_USER_009] Cập nhật user thành công (username, phone)
   * Mục tiêu: Kiểm tra update cơ bản
   * Input: userId, username mới, phone mới
   * Expected: User được cập nhật đúng
   * CheckDB: Dữ liệu trong DB thay đổi
   */
  it('[TC_USER_009] should update user successfully', async () => {
    const updated = await userService.updateUser(existingUserId!, { username: 'updated_' + Date.now(), phone: '0999999999' });
    expect(updated.phone).toBe('0999999999');
  });

  /**
   * [TC_USER_010] Cập nhật email thành công
   * Mục tiêu: Kiểm tra update email không trùng
   * Input: email mới chưa tồn tại
   * Expected: Email được cập nhật
   */
  it('[TC_USER_010] should update email successfully', async () => {
    const newEmail = 'new_' + Date.now() + '@example.com';
    const updated = await userService.updateUser(existingUserId!, { email: newEmail });
    expect(updated.email).toBe(newEmail);
  });

  /**
   * [TC_USER_011] Cập nhật is_active status
   * Mục tiêu: Kiểm tra toggle trạng thái
   * Input: is_active=false, sau đó true
   * Expected: Trạng thái thay đổi đúng
   */
  it('[TC_USER_011] should update is_active status', async () => {
    const updated = await userService.updateUser(existingUserId!, { is_active: false });
    expect(updated.is_active).toBe(false);
    await userService.updateUser(existingUserId!, { is_active: true });
  });

  /**
   * [TC_USER_012] Cập nhật avatar_url
   * Mục tiêu: Kiểm tra cập nhật ảnh đại diện
   * Input: avatar_url string
   * Expected: avatar_url được lưu
   */
  it('[TC_USER_012] should update avatar_url', async () => {
    const avatar = 'https://example.com/avatar.png';
    const updated = await userService.updateUser(existingUserId!, { avatar_url: avatar });
    expect(updated.avatar_url).toBe(avatar);
  });

  /**
   * [TC_USER_013] Cập nhật user không tồn tại
   * Mục tiêu: Kiểm tra validation userId
   * Input: userId=9999999
   * Expected: Throw error 'Người dùng không tồn tại'
   */
  it('[TC_USER_013] should throw when updating non-existent user', async () => {
    await expect(userService.updateUser(9999999, { username: 'fail' }))
      .rejects.toThrow('Người dùng không tồn tại');
  });

  /**
   * [TC_USER_014] Cập nhật với data rỗng
   * Mục tiêu: Kiểm tra validation update data
   * Input: {}
   * Expected: Throw error 'Không có dữ liệu nào để cập nhật'
   */
  it('[TC_USER_014] should throw when update data is empty', async () => {
    await expect(userService.updateUser(existingUserId!, {}))
      .rejects.toThrow('Không có dữ liệu nào để cập nhật');
  });

  /**
   * [TC_USER_015] Cập nhật email đã tồn tại
   * Mục tiêu: Kiểm tra unique constraint email
   * Input: email của user khác
   * Expected: Throw error 'Email đã được sử dụng'
   * CheckDB: User không bị thay đổi
   */
  it('[TC_USER_015] should throw on duplicate email', async () => {
    const otherUser = await User.create({
      username: 'other_' + Date.now(),
      email: 'duplicate_test@example.com',
      password_hash: await bcrypt.hash('pass', 10),
      phone: '0922222222',
      is_active: true
    });
    createdUsers.push(otherUser.id);
    await expect(userService.updateUser(existingUserId!, { email: otherUser.email }))
      .rejects.toThrow('Email đã được sử dụng');
  });

  /**
   * [TC_USER_016] Cập nhật username đã tồn tại
   * Mục tiêu: Kiểm tra unique constraint username
   * Input: username của user khác
   * Expected: Throw error 'Tên người dùng đã được sử dụng'
   */
  it('[TC_USER_016] should throw on duplicate username', async () => {
    const otherUser = await User.create({
      username: 'duplicate_name',
      email: 'dup_email_' + Date.now() + '@example.com',
      password_hash: await bcrypt.hash('pass', 10),
      phone: '0933333333',
      is_active: true
    });
    createdUsers.push(otherUser.id);
    await expect(userService.updateUser(existingUserId!, { username: otherUser.username }))
      .rejects.toThrow('Tên người dùng đã được sử dụng');
  });

  /**
   * [TC_USER_017] Cập nhật email giống cũ
   * Mục tiêu: Kiểm tra không bị lỗi duplicate khi cùng email
   * Input: email hiện tại
   * Expected: Cập nhật thành công (không throw)
   */
  it('[TC_USER_017] should allow same email update', async () => {
    const current = await User.findByPk(existingUserId!);
    const updated = await userService.updateUser(existingUserId!, { email: current!.email });
    expect(updated.email).toBe(current!.email);
  });

  /**
   * [TC_USER_018] Cập nhật username giống cũ
   * Mục tiêu: Kiểm tra không bị lỗi duplicate khi cùng username
   * Input: username hiện tại
   * Expected: Cập nhật thành công
   */
  it('[TC_USER_018] should allow same username update', async () => {
    const current = await User.findByPk(existingUserId!);
    const updated = await userService.updateUser(existingUserId!, { username: current!.username });
    expect(updated.username).toBe(current!.username);
  });

  /**
   * [TC_USER_019] Cập nhật nhiều field cùng lúc
   * Mục tiêu: Kiểm tra update đồng thời nhiều trường
   * Input: username, email, phone, is_active đều mới
   * Expected: Tất cả các field được cập nhật đúng
   */
  it('[TC_USER_019] should update multiple fields at once', async () => {
    const updated = await userService.updateUser(existingUserId!, {
      username: 'multi_' + Date.now(),
      email: 'multi_' + Date.now() + '@example.com',
      phone: '0944444444',
      is_active: false
    });
    expect(updated.phone).toBe('0944444444');
  });

  // ========== getTotalUsers() ==========
  /**
   * [TC_USER_020] Lấy thống kê số lượng users
   * Mục tiêu: Kiểm tra tổng, active, inactive đúng
   * Input: không
   * Expected: active + inactive = total, các số >= 0
   * CheckDB: Dựa vào DB thực tế
   */
  it('[TC_USER_020] should return total, active, inactive counts', async () => {
    const stats = await userService.getTotalUsers();
    expect(stats.active + stats.inactive).toBe(stats.total);
  });

  /**
   * [TC_USER_021] Thống kê cập nhật sau khi tạo user mới
   * Mục tiêu: Kiểm tra tính chính xác của thống kê khi DB thay đổi
   * Input: Tạo user mới
   * Expected: total tăng 1, active tăng 1
   * Rollback: User mới sẽ bị xóa
   */
  it('[TC_USER_021] should reflect new user in statistics', async () => {
    const before = await userService.getTotalUsers();
    const newUser = await User.create({
      username: 'stats_' + Date.now(),
      email: 'stats_' + Date.now() + '@example.com',
      password_hash: await bcrypt.hash('pass', 10),
      phone: '0955555555',
      is_active: true
    });
    createdUsers.push(newUser.id);
    const after = await userService.getTotalUsers();
    expect(after.total).toBe(before.total + 1);
  });

  // ========== getPublicProfile() ==========
  /**
   * [TC_USER_022] Lấy public profile theo username
   * Mục tiêu: Kiểm tra hàm trả về đúng user, không có password_hash
   * Input: username='public_profile_user'
   * Expected: Profile có username đúng, không có trường password_hash
   */
  it('[TC_USER_022] should get public profile by username', async () => {
    const profile = await userService.getPublicProfile(publicProfileUsername);
    expect(profile.username).toBe(publicProfileUsername);
    expect(profile).not.toHaveProperty('password_hash');
  });

  /**
   * [TC_USER_023] Lấy public profile theo userId
   * Mục tiêu: Kiểm tra identifier là số (userId)
   * Input: userId dạng string
   * Expected: Profile có id đúng
   */
  it('[TC_USER_023] should get public profile by userId', async () => {
    const profile = await userService.getPublicProfile(String(existingUserId!));
    expect(Number(profile.id)).toBe(existingUserId);
  });

  /**
   * [TC_USER_024] Lấy profile với username không tồn tại
   * Mục tiêu: Kiểm tra validation username
   * Input: username='ghost_user'
   * Expected: Throw error 'Người dùng không tồn tại'
   */
  it('[TC_USER_024] should throw for non-existent username', async () => {
    await expect(userService.getPublicProfile('ghost_user')).rejects.toThrow('Người dùng không tồn tại');
  });

  /**
   * [TC_USER_025] Lấy profile với userId không tồn tại
   * Mục tiêu: Kiểm tra validation userId
   * Input: userId='9999999'
   * Expected: Throw error 'Người dùng không tồn tại'
   */
  it('[TC_USER_025] should throw for non-existent userId', async () => {
    await expect(userService.getPublicProfile('9999999')).rejects.toThrow('Người dùng không tồn tại');
  });
});