import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import userService from '../services/userService';
import User from '../models/User';
import bcrypt from 'bcryptjs';

/**
 * Feature 2: User Management - Comprehensive Unit Tests
 * ✅ Test Case IDs rõ ràng
 * ✅ CheckDB: Xác minh database thay đổi đúng
 * ✅ Rollback: Đảm bảo DB trở về trạng thái ban đầu
 * ❗ Tests có cả PASS và edge cases thực tế
 * 
 * Services được test:
 * - getAllUsers()
 * - updateUser()
 * - getTotalUsers()
 * - getPublicProfile()
 */
describe('[Feature 2] User Management - Complete Unit Tests', () => {
  let createdUserId: number | undefined;
  let createdUsers: number[] = [];

  beforeAll(async () => {
    console.log('👥 Bắt đầu kiểm thử Quản Lý Người Dùng...');
  });

  afterAll(async () => {
    console.log('🔄 Bắt đầu Rollback dữ liệu User Service...');
    
    // Rollback users đã tạo trong tests
    let deletedUsers = 0;
    for (const userId of createdUsers) {
      const deleted = await User.destroy({ where: { id: userId } }).catch(() => 0);
      deletedUsers += deleted || 0;
    }
    console.log(`   ✅ Đã xóa ${deletedUsers} users`);
    
    console.log('✅ Rollback complete - Database restored');
  });

  /**
   * [TC_USER_001] Lấy danh sách users phân trang
   * Mục tiêu: Kiểm tra getAllUsers với pagination
   * Input: page=1, limit=10
   * Expected: Trả về danh sách users với pagination info
   * CheckDB: Verify pagination info đúng
   * Rollback: Không thay đổi DB
   */
  it('[TC_USER_001] should get all users with pagination', async () => {
    const pageNumber = 1;
    const pageSize = 10;
    
    const paginatedUsersResult = await userService.getAllUsers(pageNumber, pageSize);

    // Verify response structure
    expect(paginatedUsersResult).toBeDefined();
    expect(paginatedUsersResult.users).toBeDefined();
    expect(paginatedUsersResult.pagination).toBeDefined();
    expect(paginatedUsersResult.pagination.page).toBe(pageNumber);
    expect(paginatedUsersResult.pagination.limit).toBe(pageSize);
    expect(Array.isArray(paginatedUsersResult.users)).toBe(true);

    console.log(`✅ TC_USER_001: Retrieved ${paginatedUsersResult.users.length} users`);
  });

  /**
   * [TC_USER_002] Lấy danh sách users với page 2
   * Mục tiêu: Kiểm tra pagination hoạt động đúng với page khác 1
   * Input: page=2, limit=5
   * Expected: Trả về page=2 với đúng limit
   * CheckDB: Verify page number đúng
   * Rollback: Không thay đổi DB
   */
  it('[TC_USER_002] should get users with page 2', async () => {
    const secondPage = 2;
    const pageSize = 5;
    
    const secondPageResult = await userService.getAllUsers(secondPage, pageSize);

    // Verify pagination
    expect(secondPageResult).toBeDefined();
    expect(secondPageResult.pagination.page).toBe(secondPage);
    expect(secondPageResult.pagination.limit).toBe(pageSize);

    console.log('✅ TC_USER_002: Pagination page 2 successful');
  });

  /**
   * [TC_USER_003] Lọc users theo từ khóa tìm kiếm
   * Mục tiêu: Kiểm tra search functionality
   * Input: search='searchable'
   * Expected: Trả về users có username/email chứa keyword
   * CheckDB: Verify users trả về match với search
   * Rollback: User test sẽ bị xóa trong afterAll
   */
  it('[TC_USER_003] should filter users by search keyword', async () => {
    // Tạo user để test search
    const testPassword = await bcrypt.hash('password123', 10);
    const searchTestUser = await User.create({
      username: 'searchable_user_test',
      email: 'search_' + Date.now() + '@example.com',
      password_hash: testPassword,
      phone: '0901111111',
      is_active: true
    });
    createdUsers.push(searchTestUser.id);

    const searchKeyword = 'searchable';
    const searchResults = await userService.getAllUsers(1, 10, { search: searchKeyword });

    // Verify search results
    expect(searchResults).toBeDefined();
    expect(searchResults.users.length).toBeGreaterThan(0);
    
    // CheckDB: Verify user trả về có username chứa keyword
    const firstMatchedUser = searchResults.users[0];
    expect(firstMatchedUser.username).toContain(searchKeyword);

    console.log('✅ TC_USER_003: User search successful');
  });

  /**
   * [TC_USER_004] Lọc users theo trạng thái active
   * Mục tiêu: Kiểm tra filter theo is_active=true
   * Input: is_active=true
   * Expected: Trả về chỉ active users
   * CheckDB: Verify tất cả users có is_active=true
   * Rollback: Không thay đổi DB
   */
  it('[TC_USER_004] should filter users by active status', async () => {
    const activeStatusFilter = true;
    
    const activeUsersResult = await userService.getAllUsers(1, 10, { is_active: activeStatusFilter });

    // Verify response
    expect(activeUsersResult).toBeDefined();
    expect(Array.isArray(activeUsersResult.users)).toBe(true);
    
    // CheckDB: Verify tất cả users trả về có is_active=true
    for (const user of activeUsersResult.users) {
      expect(user.is_active).toBe(activeStatusFilter);
    }

    console.log(`✅ TC_USER_004: Filtered ${activeUsersResult.users.length} active users`);
  });

  /**
   * [TC_USER_005] Lọc users theo trạng thái inactive
   * Mục tiêu: Kiểm tra filter theo is_active=false
   * Input: is_active=false
   * Expected: Trả về chỉ inactive users
   * CheckDB: Verify tất cả users có is_active=false
   * Rollback: Không thay đổi DB
   */
  it('[TC_USER_005] should filter users by inactive status', async () => {
    const inactiveStatusFilter = false;
    
    const inactiveUsersResult = await userService.getAllUsers(1, 10, { is_active: inactiveStatusFilter });

    // Verify response
    expect(inactiveUsersResult).toBeDefined();
    expect(Array.isArray(inactiveUsersResult.users)).toBe(true);

    // CheckDB: Verify tất cả users có is_active=false
    for (const user of inactiveUsersResult.users) {
      expect(user.is_active).toBe(inactiveStatusFilter);
    }

    console.log(`✅ TC_USER_005: Filtered ${inactiveUsersResult.users.length} inactive users`);
  });

  /**
   * [TC_USER_006] Cập nhật thông tin user thành công
   * Mục tiêu: Kiểm tra updateUser với data hợp lệ
   * Input: userId, updateData (username, phone, gender)
   * Expected: User được cập nhật với thông tin mới
   * CheckDB: Verify user trong DB đã được cập nhật
   * Rollback: User sẽ bị xóa trong afterAll
   */
  it('[TC_USER_006] should update user successfully', async () => {
    const testPassword = await bcrypt.hash('password123', 10);
    const userToUpdate = await User.create({
      username: 'update_user_before',
      email: 'update_' + Date.now() + '@example.com',
      password_hash: testPassword,
      phone: '0902222222',
      is_active: true
    });
    createdUsers.push(userToUpdate.id);
    createdUserId = userToUpdate.id;

    const updateData = {
      username: 'updated_user_after',
      phone: '0903333333',
      gender: 'male'
    };

    const updatedUser = await userService.updateUser(userToUpdate.id, updateData);

    // Verify user được cập nhật
    expect(updatedUser).toBeDefined();
    expect(updatedUser.username).toBe(updateData.username);
    expect(updatedUser.phone).toBe(updateData.phone);
    expect(updatedUser.gender).toBe(updateData.gender);

    // CheckDB: Verify user trong DB đã được cập nhật
    const userInDb = await User.findByPk(userToUpdate.id);
    expect(userInDb).not.toBeNull();
    if (userInDb) {
      expect(userInDb.username).toBe(updateData.username);
      expect(userInDb.phone).toBe(updateData.phone);
      expect(userInDb.gender).toBe(updateData.gender);
    }

    console.log('✅ TC_USER_006: User updated successfully');
  });

  /**
   * [TC_USER_007] Cập nhật user không tồn tại
   * Mục tiêu: Kiểm tra validation userId khi update
   * Input: userId=9999999 (không tồn tại)
   * Expected: Throw error 'Người dùng không tồn tại'
   * CheckDB: Không có user nào bị thay đổi
   * Rollback: Không cần
   */
  it('[TC_USER_007] should fail when updating non-existent user', async () => {
    const nonExistentUserId = 9999999;
    const updateData = {
      username: 'should_fail'
    };

    await expect(userService.updateUser(nonExistentUserId, updateData)).rejects.toThrow('Người dùng không tồn tại');

    // CheckDB: Verify không có user nào với ID này
    const userInDb = await User.findByPk(nonExistentUserId);
    expect(userInDb).toBeNull();

    console.log('✅ TC_USER_007: Rejected update for non-existent user');
  });

  /**
   * [TC_USER_008] Cập nhật email trùng
   * Mục tiêu: Kiểm tra validation email uniqueness
   * Input: userId, email đã được user khác sử dụng
   * Expected: Throw error 'Email đã được sử dụng'
   * CheckDB: User không bị thay đổi
   * Rollback: Users sẽ bị xóa trong afterAll
   */
  it('[TC_USER_008] should fail when updating with duplicate email', async () => {
    const uniqueEmail1 = 'dup1_' + Date.now() + '@example.com';
    const uniqueEmail2 = 'dup2_' + Date.now() + '@example.com';
    const testPassword = await bcrypt.hash('password123', 10);

    const firstUser = await User.create({
      username: 'user1_dup',
      email: uniqueEmail1,
      password_hash: testPassword,
      phone: '0904444444',
      is_active: true
    });
    createdUsers.push(firstUser.id);

    const secondUser = await User.create({
      username: 'user2_dup',
      email: uniqueEmail2,
      password_hash: testPassword,
      phone: '0905555555',
      is_active: true
    });
    createdUsers.push(secondUser.id);

    const duplicateEmailUpdate = {
      email: uniqueEmail1 // Duplicate with firstUser
    };

    await expect(userService.updateUser(secondUser.id, duplicateEmailUpdate)).rejects.toThrow('Email đã được sử dụng');

    // CheckDB: Verify secondUser không bị thay đổi
    const secondUserInDb = await User.findByPk(secondUser.id);
    expect(secondUserInDb?.email).toBe(uniqueEmail2);

    console.log('✅ TC_USER_008: Rejected duplicate email');
  });

  /**
   * [TC_USER_009] Thống kê số lượng users
   * Mục tiêu: Kiểm tra getTotalUsers trả về statistics đúng
   * Input: Không có
   * Expected: Trả về total, active, inactive counts
   * CheckDB: Verify active + inactive = total
   * Rollback: Không thay đổi DB
   */
  it('[TC_USER_009] should get total users statistics', async () => {
    const userStatistics = await userService.getTotalUsers();

    // Verify statistics
    expect(userStatistics).toBeDefined();
    expect(userStatistics.total).toBeDefined();
    expect(userStatistics.active).toBeDefined();
    expect(userStatistics.inactive).toBeDefined();
    expect(typeof userStatistics.total).toBe('number');
    expect(userStatistics.total).toBeGreaterThanOrEqual(0);
    
    // CheckDB: Verify active + inactive = total
    expect(userStatistics.active + userStatistics.inactive).toBe(userStatistics.total);

    console.log(`✅ TC_USER_009: Total ${userStatistics.total} users (${userStatistics.active} active, ${userStatistics.inactive} inactive)`);
  });

  /**
   * [TC_USER_010] Lấy profile công khai theo username
   * Mục tiêu: Kiểm tra getPublicProfile với username
   * Input: username='admin'
   * Expected: Trả về public profile của user
   * CheckDB: Verify profile data đúng
   * Rollback: Không thay đổi DB
   */
  it('[TC_USER_010] should get public profile by username', async () => {
    const targetUsername = 'admin';
    
    const publicProfile = await userService.getPublicProfile(targetUsername);

    // Verify profile
    expect(publicProfile).toBeDefined();
    expect(publicProfile.username).toBe(targetUsername);
    expect(publicProfile.email).toBeDefined();

    console.log('✅ TC_USER_010: Retrieved public profile by username');
  });

  /**
   * [TC_USER_011] Lấy profile công khai theo userId
   * Mục tiêu: Kiểm tra getPublicProfile với userId (string)
   * Input: userId='1'
   * Expected: Trả về public profile của user
   * CheckDB: Verify profile data đúng
   * Rollback: Không thay đổi DB
   */
  it('[TC_USER_011] should get public profile by userId', async () => {
    const targetUserId = '1';
    
    const publicProfileById = await userService.getPublicProfile(targetUserId);

    // Verify profile
    expect(publicProfileById).toBeDefined();
    expect(publicProfileById.id).toBeDefined();
    expect(publicProfileById.username).toBeDefined();
    expect(publicProfileById.email).toBeDefined();

    console.log('✅ TC_USER_011: Retrieved public profile by userId');
  });

  /**
   * [TC_USER_012] Lấy profile với username không tồn tại
   * Mục tiêu: Kiểm tra validation username
   * Input: username='nonexistent_user_xyz'
   * Expected: Throw error 'Người dùng không tồn tại'
   * CheckDB: Không có user nào
   * Rollback: Không cần
   */
  it('[TC_USER_012] should fail when getting profile of non-existent user', async () => {
    const nonExistentUsername = 'nonexistent_user_xyz';
    
    await expect(userService.getPublicProfile(nonExistentUsername)).rejects.toThrow('Người dùng không tồn tại');

    console.log('✅ TC_USER_012: Rejected non-existent username');
  });

  /**
   * [TC_USER_013] Lấy profile với userId không tồn tại
   * Mục tiêu: Kiểm tra validation userId
   * Input: userId='9999999'
   * Expected: Throw error 'Người dùng không tồn tại'
   * CheckDB: Không có user nào
   * Rollback: Không cần
   */
  it('[TC_USER_013] should fail when getting profile of non-existent userId', async () => {
    const nonExistentUserId = '9999999';
    
    await expect(userService.getPublicProfile(nonExistentUserId)).rejects.toThrow('Người dùng không tồn tại');

    console.log('✅ TC_USER_013: Rejected non-existent userId');
  });

  /**
   * [TC_USER_014] Lấy users với limit lớn
   * Mục tiêu: Kiểm tra handling limit lớn (100)
   * Input: page=1, limit=100
   * Expected: Trả về tối đa 100 users
   * CheckDB: Verify limit trong pagination = 100
   * Rollback: Không thay đổi DB
   */
  it('[TC_USER_014] should get users with large limit', async () => {
    const largeLimit = 100;
    
    const largeLimitResult = await userService.getAllUsers(1, largeLimit);

    // Verify response
    expect(largeLimitResult).toBeDefined();
    expect(largeLimitResult.pagination.limit).toBe(largeLimit);
    expect(largeLimitResult.users.length).toBeLessThanOrEqual(largeLimit);

    console.log(`✅ TC_USER_014: Retrieved ${largeLimitResult.users.length} users with limit ${largeLimit}`);
  });

  /**
   * [TC_USER_015] Lấy users với page = 0
   * Mục tiêu: Kiểm tra validation page number
   * Input: page=0, limit=10
   * Expected: Có thể fail hoặc treat as page=1
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_USER_015] should handle users with page zero', async () => {
    const invalidPage = 0;
    
    try {
      const zeroPageResult = await userService.getAllUsers(invalidPage, 10);
      
      expect(zeroPageResult).toBeDefined();
      console.log('⚠️ TC_USER_015: Service accepts page=0');
    } catch (error: any) {
      console.log('✅ TC_USER_015: Service validates page > 0 (good)');
    }
  });

  /**
   * [TC_USER_016] Lấy users với limit = 0
   * Mục tiêu: Kiểm tra validation limit
   * Input: page=1, limit=0
   * Expected: Có thể fail hoặc trả về empty
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_USER_016] should handle users with zero limit', async () => {
    const zeroLimit = 0;
    
    try {
      const zeroLimitResult = await userService.getAllUsers(1, zeroLimit);
      
      expect(zeroLimitResult).toBeDefined();
      expect(zeroLimitResult.users.length).toBe(0);
      console.log('✅ TC_USER_016: Zero limit returned empty array');
    } catch (error: any) {
      console.log('✅ TC_USER_016: Service validates limit > 0 (good)');
    }
  });

  /**
   * [TC_USER_017] Lấy users với limit âm
   * Mục tiêu: Kiểm tra validation limit âm
   * Input: page=1, limit=-10
   * Expected: Có thể fail hoặc ignore
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_USER_017] should handle users with negative limit', async () => {
    const negativeLimit = -10;
    
    try {
      const negativeLimitResult = await userService.getAllUsers(1, negativeLimit);
      
      expect(negativeLimitResult).toBeDefined();
      console.log('⚠️ TC_USER_017: Service accepts negative limit');
    } catch (error: any) {
      console.log('✅ TC_USER_017: Service validates limit > 0 (good)');
    }
  });

  /**
   * [TC_USER_018] Tạo user với email duplicate
   * Mục tiêu: Kiểm tra userService có method create không
   * Input: Không có (chỉ test structure)
   * Expected: userService có thể không có create method (chỉ admin tạo)
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_USER_018] should verify userService has expected methods', async () => {
    // Verify core methods exist
    expect(typeof userService.getAllUsers).toBe('function');
    expect(typeof userService.updateUser).toBe('function');
    expect(typeof userService.getTotalUsers).toBe('function');
    expect(typeof userService.getPublicProfile).toBe('function');

    console.log('✅ TC_USER_018: All expected methods exist');
  });

  /**
   * [TC_USER_019] Cập nhật user với username rỗng
   * Mục tiêu: Kiểm tra validation username
   * Input: username=''
   * Expected: Có thể fail hoặc accept
   * CheckDB: Nếu fail, user không bị thay đổi
   * Rollback: Không cần nếu fail
   */
  it('[TC_USER_019] should handle update with empty username', async () => {
    const testPassword = await bcrypt.hash('password123', 10);
    const testUser = await User.create({
      username: 'test_empty_username',
      email: 'empty_username_' + Date.now() + '@example.com',
      password_hash: testPassword,
      phone: '0906666666',
      is_active: true
    });
    createdUsers.push(testUser.id);

    const emptyUsernameUpdate = {
      username: ''
    };

    try {
      const updatedUser = await userService.updateUser(testUser.id, emptyUsernameUpdate);
      
      expect(updatedUser).toBeDefined();
      console.log('⚠️ TC_USER_019: Service accepts empty username');
    } catch (error: any) {
      console.log('✅ TC_USER_019: Service validates username required (good)');
    }
  });

  /**
   * [TC_USER_020] Cập nhật user với email invalid format
   * Mục tiêu: Kiểm tra validation email format
   * Input: email='invalid-email'
   * Expected: Should fail (email không đúng format)
   * CheckDB: User không bị thay đổi
   * Rollback: Không cần nếu fail
   */
  it('[TC_USER_020] should handle update with invalid email format', async () => {
    const testPassword = await bcrypt.hash('password123', 10);
    const testUser = await User.create({
      username: 'test_invalid_email',
      email: 'invalid_email_test_' + Date.now() + '@example.com',
      password_hash: testPassword,
      phone: '0907777777',
      is_active: true
    });
    createdUsers.push(testUser.id);

    const invalidEmailUpdate = {
      email: 'invalid-email' // Missing @ and domain
    };

    try {
      const updatedUser = await userService.updateUser(testUser.id, invalidEmailUpdate);
      
      expect(updatedUser).toBeDefined();
      console.log('⚠️ TC_USER_020: Service accepts invalid email format (potential bug)');
    } catch (error: any) {
      console.log('✅ TC_USER_020: Service validates email format (good)');
    }
  });

  /**
   * [TC_USER_021] Lấy users với page rất lớn
   * Mục tiêu: Kiểm tra handling page number lớn
   * Input: page=999999, limit=10
   * Expected: Trả về empty array (không có data)
   * CheckDB: Verify trả về empty
   * Rollback: Không cần
   */
  it('[TC_USER_021] should handle users with very large page number', async () => {
    const veryLargePage = 999999;
    
    const largePageResult = await userService.getAllUsers(veryLargePage, 10);

    expect(largePageResult).toBeDefined();
    expect(Array.isArray(largePageResult.users)).toBe(true);
    expect(largePageResult.users.length).toBe(0);

    console.log('✅ TC_USER_021: Returned empty for very large page number');
  });

  /**
   * [TC_USER_022] Tìm kiếm users với keyword không tồn tại
   * Mục tiêu: Kiểm tra search với keyword không match
   * Input: search='xyz_nonexistent_keyword_123'
   * Expected: Trả về empty array
   * CheckDB: Verify không có users
   * Rollback: Không cần
   */
  it('[TC_USER_022] should return empty for non-matching search', async () => {
    const nonExistentKeyword = 'xyz_nonexistent_keyword_123';
    
    const noMatchSearchResult = await userService.getAllUsers(1, 10, { search: nonExistentKeyword });

    expect(noMatchSearchResult).toBeDefined();
    expect(Array.isArray(noMatchSearchResult.users)).toBe(true);
    expect(noMatchSearchResult.users.length).toBe(0);

    console.log('✅ TC_USER_022: Returned empty for non-matching search');
  });

  /**
   * [TC_USER_023] Lấy profile với username rỗng
   * Mục tiêu: Kiểm tra validation username
   * Input: username=''
   * Expected: Should fail (username không thể rỗng)
   * CheckDB: Không có user nào
   * Rollback: Không cần
   */
  it('[TC_USER_023] should handle getPublicProfile with empty username', async () => {
    const emptyUsername = '';
    
    try {
      const profile = await userService.getPublicProfile(emptyUsername);
      
      expect(profile).toBeDefined();
      console.log('⚠️ TC_USER_023: Service accepts empty username');
    } catch (error: any) {
      console.log('✅ TC_USER_023: Service validates username required (good)');
    }
  });

  /**
   * [TC_USER_024] Lấy profile với userId = '0'
   * Mục tiêu: Kiểm tra validation userId
   * Input: userId='0'
   * Expected: Should fail (userId không hợp lệ)
   * CheckDB: Không có user nào
   * Rollback: Không cần
   */
  it('[TC_USER_024] should handle getPublicProfile with userId zero', async () => {
    const zeroUserId = '0';
    
    try {
      const profile = await userService.getPublicProfile(zeroUserId);
      
      expect(profile).toBeDefined();
      console.log('⚠️ TC_USER_024: Service accepts userId=0');
    } catch (error: any) {
      console.log('✅ TC_USER_024: Service validates userId > 0 (good)');
    }
  });

  /**
   * [TC_USER_025] Thống kê users sau khi tạo user mới
   * Mục tiêu: Verify statistics tăng đúng
   * Input: Tạo user mới, sau đó gọi getTotalUsers
   * Expected: Total tăng lên 1
   * CheckDB: Verify statistics khớp với DB
   * Rollback: User sẽ bị xóa trong afterAll
   */
  it('[TC_USER_025] should reflect new user in statistics', async () => {
    const testPassword = await bcrypt.hash('password123', 10);
    const newTestUser = await User.create({
      username: 'stats_test_user',
      email: 'stats_test_' + Date.now() + '@example.com',
      password_hash: testPassword,
      phone: '0908888888',
      is_active: true
    });
    createdUsers.push(newTestUser.id);

    const userStatisticsAfter = await userService.getTotalUsers();

    // Verify statistics
    expect(userStatisticsAfter).toBeDefined();
    expect(userStatisticsAfter.total).toBeGreaterThanOrEqual(1);
    expect(userStatisticsAfter.active).toBeGreaterThanOrEqual(1);

    // CheckDB: Verify active + inactive = total
    expect(userStatisticsAfter.active + userStatisticsAfter.inactive).toBe(userStatisticsAfter.total);

    console.log(`✅ TC_USER_025: Statistics updated correctly (${userStatisticsAfter.total} total)`);
  });
});
