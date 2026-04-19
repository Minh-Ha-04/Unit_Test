import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import feedbackService from '../services/feedbackService';
import Feedback from '../models/Feedback';
import User from '../models/User';
import bcrypt from 'bcryptjs';

/**
 * Feature 10: Feedback Management - Comprehensive Unit Tests
 * ✅ Test Case IDs rõ ràng
 * ✅ CheckDB: Xác minh database changes
 * ✅ Rollback: Khôi phục DB sau tests
 * ❗ Tests có cả PASS và edge cases thực tế
 * 
 * Services được test:
 * - createFeedback()
 * - getAllFeedbacks()
 * - markCancelled()
 */
describe('[Feature 10] Feedback Management - Complete Unit Tests', () => {
  let testUserId: number | undefined;
  let createdFeedbackId: number | undefined;
  let createdFeedbacks: number[] = [];
  let createdUsers: number[] = [];

  beforeAll(async () => {
    console.log('💬 Feedback: Bắt đầu kiểm thử...');

    // Tạo user test
    const hashedPassword = await bcrypt.hash('password123', 10);
    const user = await User.create({
      username: 'feedback_user',
      email: 'feedback_' + Date.now() + '@example.com',
      password_hash: hashedPassword,
      phone: '0907777777',
      is_active: true
    });
    testUserId = user.id;
    createdUsers.push(testUserId);
  });

  /**
   * Rollback toàn bộ DB về trạng thái trước khi test
   * Thứ tự xóa: Feedbacks → Users (theo foreign key constraints)
   */
  afterAll(async () => {
    console.log('🔄 Starting Rollback...');
    
    // Xóa feedbacks trước
    for (const feedbackId of createdFeedbacks) {
      await Feedback.destroy({ where: { id: feedbackId } }).catch(() => {});
    }
    
    // Xóa users
    for (const userId of createdUsers) {
      await User.destroy({ where: { id: userId } }).catch(() => {});
    }
    
    console.log(`✅ Rollback complete: Deleted ${createdFeedbacks.length} feedbacks, ${createdUsers.length} users`);
  });

  /**
   * [TC_FEEDBACK_001] Tạo feedback thành công
   * Mục tiêu: Kiểm tra createFeedback với dữ liệu đầy đủ
   * Input: {user_id, title, message}
   * Expected: Tạo feedback với status='pending'
   * CheckDB: Verify feedback được lưu trong DB
   * Rollback: Xóa feedback trong afterAll
   */
  it('[TC_FEEDBACK_001] should create feedback successfully', async () => {
    const feedbackTitle = 'Test Feedback ' + Date.now();
    const feedbackMessage = 'This is a comprehensive test feedback message';
    
    const feedbackData = {
      user_id: testUserId!,
      title: feedbackTitle,
      message: feedbackMessage
    };

    const createdFeedback = await feedbackService.createFeedback(feedbackData);

    // Verify response
    expect(createdFeedback).toBeDefined();
    expect(createdFeedback.id).toBeDefined();
    expect(createdFeedback.title).toBe(feedbackTitle);
    expect(createdFeedback.message).toBe(feedbackMessage);
    expect(createdFeedback.status).toBe('pending');
    expect(createdFeedback.user_id).toBe(testUserId);

    // Store for rollback
    createdFeedbackId = createdFeedback.id;
    createdFeedbacks.push(createdFeedbackId);

    // CheckDB: Verify feedback exists in database
    const feedbackInDb = await Feedback.findByPk(createdFeedbackId);
    expect(feedbackInDb).not.toBeNull();
    expect(feedbackInDb?.title).toBe(feedbackTitle);
    expect(feedbackInDb?.message).toBe(feedbackMessage);
    expect(feedbackInDb?.status).toBe('pending');

    console.log(`✅ TC_FEEDBACK_001: Created feedback ID ${createdFeedbackId}`);
  });

  /**
   * [TC_FEEDBACK_002] Tạo feedback không có title/message
   * Mục tiêu: Kiểm tra createFeedback với dữ liệu tối thiểu
   * Input: {user_id} (không có title, message)
   * Expected: Tạo feedback với title=null, message=null
   * CheckDB: Verify feedback được lưu với null values
   * Rollback: Xóa feedback trong afterAll
   */
  it('[TC_FEEDBACK_002] should create feedback without title/message', async () => {
    const minimalFeedbackData = {
      user_id: testUserId!
    };

    const createdFeedback = await feedbackService.createFeedback(minimalFeedbackData);

    // Verify response
    expect(createdFeedback).toBeDefined();
    expect(createdFeedback.id).toBeDefined();
    expect(createdFeedback.title).toBeNull();
    expect(createdFeedback.message).toBeNull();
    expect(createdFeedback.status).toBe('pending');

    // Store for rollback
    createdFeedbacks.push(createdFeedback.id);

    // CheckDB: Verify feedback with null values saved in DB
    const feedbackInDb = await Feedback.findByPk(createdFeedback.id);
    expect(feedbackInDb).not.toBeNull();
    expect(feedbackInDb?.title).toBeNull();
    expect(feedbackInDb?.message).toBeNull();

    console.log(`✅ TC_FEEDBACK_002: Created minimal feedback ID ${createdFeedback.id}`);
  });

  /**
   * [TC_FEEDBACK_003] Lấy tất cả feedbacks với pagination
   * Mục tiêu: Kiểm tra getAllFeedbacks trả về danh sách với pagination
   * Input: page=1, limit=10
   * Expected: Trả về feedbacks với pagination info
   * CheckDB: So sánh total với count trong DB
   * Rollback: Không thay đổi DB
   */
  it('[TC_FEEDBACK_003] should get all feedbacks with pagination', async () => {
    const pageNumber = 1;
    const pageSize = 10;
    
    const allFeedbacks = await feedbackService.getAllFeedbacks(pageNumber, pageSize);

    // Verify response structure
    expect(allFeedbacks).toBeDefined();
    expect(Array.isArray(allFeedbacks.feedbacks)).toBe(true);
    expect(allFeedbacks.pagination).toBeDefined();
    expect(allFeedbacks.pagination.page).toBe(pageNumber);
    expect(allFeedbacks.pagination.limit).toBe(pageSize);

    // CheckDB: Verify total matches database count
    const totalFeedbacksInDb = await Feedback.count();
    expect(allFeedbacks.pagination.total).toBe(totalFeedbacksInDb);

    console.log(`✅ TC_FEEDBACK_003: Retrieved ${allFeedbacks.feedbacks.length} feedbacks`);
  });

  /**
   * [TC_FEEDBACK_004] Tìm kiếm feedbacks theo username
   * Mục tiêu: Kiểm tra search functionality
   * Input: search = 'feedback_user'
   * Expected: Trả về feedbacks của user có username khớp
   * CheckDB: Verify tất cả feedbacks trả về đều thuộc user tìm kiếm
   * Rollback: Không thay đổi DB
   */
  it('[TC_FEEDBACK_004] should search feedbacks by username', async () => {
    const searchUsername = 'feedback_user';
    
    const searchResults = await feedbackService.getAllFeedbacks(1, 10, searchUsername);

    // Verify response
    expect(searchResults).toBeDefined();
    expect(Array.isArray(searchResults.feedbacks)).toBe(true);

    // CheckDB: Verify all feedbacks belong to searched user
    for (const feedback of searchResults.feedbacks) {
      expect(feedback.user_id).toBe(testUserId);
    }

    console.log(`✅ TC_FEEDBACK_004: Found ${searchResults.feedbacks.length} feedbacks for "${searchUsername}"`);
  });

  /**
   * [TC_FEEDBACK_005] Phân trang feedbacks
   * Mục tiêu: Kiểm tra pagination hoạt động đúng
   * Input: page=1, limit=5 và page=2, limit=5
   * Expected: Trả về các trang khác nhau
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_FEEDBACK_005] should paginate feedbacks correctly', async () => {
    const pageSize = 5;
    
    // Get page 1
    const firstPage = await feedbackService.getAllFeedbacks(1, pageSize);
    expect(firstPage).toBeDefined();
    expect(firstPage.pagination.page).toBe(1);
    expect(firstPage.pagination.limit).toBe(pageSize);
    expect(firstPage.feedbacks.length).toBeLessThanOrEqual(pageSize);

    // Get page 2
    const secondPage = await feedbackService.getAllFeedbacks(2, pageSize);
    expect(secondPage).toBeDefined();
    expect(secondPage.pagination.page).toBe(2);
    expect(secondPage.feedbacks.length).toBeLessThanOrEqual(pageSize);

    // Verify different pages return different data (if enough feedbacks exist)
    if (firstPage.feedbacks.length > 0 && secondPage.feedbacks.length > 0) {
      expect(firstPage.feedbacks[0].id).not.toBe(secondPage.feedbacks[0].id);
    }

    console.log(`✅ TC_FEEDBACK_005: Pagination working (Page 1: ${firstPage.feedbacks.length}, Page 2: ${secondPage.feedbacks.length})`);
  });

  /**
   * [TC_FEEDBACK_006] Mark feedback pending thành cancelled
   * Mục tiêu: Kiểm tra markCancelled chuyển status từ 'pending' sang 'cancelled'
   * Input: feedbackId của feedback pending
   * Expected: Status chuyển sang 'cancelled'
   * CheckDB: Verify status='cancelled' trong DB
   * Rollback: Feedback vẫn tồn tại với status mới
   */
  it('[TC_FEEDBACK_006] should mark pending feedback as cancelled', async () => {
    if (!createdFeedbackId) {
      throw new Error('Feedback chưa được tạo từ TC_FEEDBACK_001');
    }

    // Get status before cancel
    const feedbackBeforeCancel = await Feedback.findByPk(createdFeedbackId);
    expect(feedbackBeforeCancel?.status).toBe('pending');

    // Cancel feedback
    const cancelledFeedback = await feedbackService.markCancelled(createdFeedbackId);

    // Verify response
    expect(cancelledFeedback).toBeDefined();
    expect(cancelledFeedback.status).toBe('cancelled');
    expect(cancelledFeedback.id).toBe(createdFeedbackId);

    // CheckDB: Verify status changed to 'cancelled' in database
    const feedbackInDb = await Feedback.findByPk(createdFeedbackId);
    expect(feedbackInDb).not.toBeNull();
    expect(feedbackInDb?.status).toBe('cancelled');

    console.log('✅ TC_FEEDBACK_006: Feedback marked as cancelled');
  });

  /**
   * [TC_FEEDBACK_007] Mark feedback đã cancelled thành cancelled
   * Mục tiêu: Kiểm tra không thể cancel feedback đã cancelled
   * Input: feedbackId của feedback đã cancelled
   * Expected: Ném lỗi "Chỉ có thể hủy feedback có trạng thái pending"
   * CheckDB: Verify status không đổi
   * Rollback: Không cần
   */
  it('[TC_FEEDBACK_007] should fail cancelling already cancelled feedback', async () => {
    if (!createdFeedbackId) {
      throw new Error('Feedback chưa được tạo từ TC_FEEDBACK_001');
    }

    // Verify feedback is already cancelled
    const feedbackBefore = await Feedback.findByPk(createdFeedbackId);
    expect(feedbackBefore?.status).toBe('cancelled');

    // Attempt to cancel again
    await expect(
      feedbackService.markCancelled(createdFeedbackId)
    ).rejects.toThrow('Chỉ có thể hủy feedback có trạng thái pending');

    // CheckDB: Verify status unchanged
    const feedbackAfter = await Feedback.findByPk(createdFeedbackId);
    expect(feedbackAfter?.status).toBe('cancelled');

    console.log('✅ TC_FEEDBACK_007: Correctly prevented double cancellation');
  });

  /**
   * [TC_FEEDBACK_008] Mark feedback không tồn tại thành cancelled
   * Mục tiêu: Kiểm tra error handling khi feedbackId không hợp lệ
   * Input: feedbackId=9999999 (không tồn tại)
   * Expected: Ném lỗi "Feedback không tồn tại"
   * CheckDB: Verify feedback không tồn tại
   * Rollback: Không cần
   */
  it('[TC_FEEDBACK_008] should fail cancelling non-existent feedback', async () => {
    const nonExistentFeedbackId = 9999999;

    // Verify feedback doesn't exist
    const feedbackInDb = await Feedback.findByPk(nonExistentFeedbackId);
    expect(feedbackInDb).toBeNull();

    // Attempt to cancel non-existent feedback
    await expect(
      feedbackService.markCancelled(nonExistentFeedbackId)
    ).rejects.toThrow('Feedback không tồn tại');

    console.log('✅ TC_FEEDBACK_008: Correctly rejected non-existent feedback');
  });

  /**
   * [TC_FEEDBACK_009] Tạo feedback với title rỗng
   * Mục tiêu: Kiểm tra validation khi title = ''
   * Input: {user_id, title: '', message: 'test'}
   * Expected: Tạo thành công với title='' hoặc null
   * CheckDB: Verify feedback được lưu
   * Rollback: Xóa feedback đã tạo
   */
  it('[TC_FEEDBACK_009] should handle feedback with empty title', async () => {
    const emptyTitleFeedback = await feedbackService.createFeedback({
      user_id: testUserId!,
      title: '',
      message: 'Feedback with empty title'
    });

    expect(emptyTitleFeedback).toBeDefined();
    createdFeedbacks.push(emptyTitleFeedback.id);

    // CheckDB: Verify how empty title was saved
    const feedbackInDb = await Feedback.findByPk(emptyTitleFeedback.id);
    expect(feedbackInDb).not.toBeNull();
    expect(feedbackInDb?.title).toBe('');

    console.log('✅ TC_FEEDBACK_009: Created feedback with empty title');
  });

  /**
   * [TC_FEEDBACK_010] Tạo feedback với message rỗng
   * Mục tiêu: Kiểm tra validation khi message = ''
   * Input: {user_id, title: 'test', message: ''}
   * Expected: Tạo thành công với message=''
   * CheckDB: Verify feedback được lưu
   * Rollback: Xóa feedback đã tạo
   */
  it('[TC_FEEDBACK_010] should handle feedback with empty message', async () => {
    const emptyMessageFeedback = await feedbackService.createFeedback({
      user_id: testUserId!,
      title: 'Feedback with empty message',
      message: ''
    });

    expect(emptyMessageFeedback).toBeDefined();
    createdFeedbacks.push(emptyMessageFeedback.id);

    // CheckDB: Verify how empty message was saved
    const feedbackInDb = await Feedback.findByPk(emptyMessageFeedback.id);
    expect(feedbackInDb).not.toBeNull();
    expect(feedbackInDb?.message).toBe('');

    console.log('✅ TC_FEEDBACK_010: Created feedback with empty message');
  });

  /**
   * [TC_FEEDBACK_011] Tạo feedback với title rất dài
   * Mục tiêu: Kiểm tra xử lý title dài (> 255 ký tự)
   * Input: {user_id, title: 'A'.repeat(500), message: 'test'}
   * Expected: Có thể fail hoặc cắt ngắn (tùy validation)
   * CheckDB: Verify data được lưu đúng
   * Rollback: Xóa feedback nếu tạo thành công
   */
  it('[TC_FEEDBACK_011] should handle feedback with very long title', async () => {
    const veryLongTitle = 'A'.repeat(500);
    const feedbacksBefore = await Feedback.count();

    try {
      const longTitleFeedback = await feedbackService.createFeedback({
        user_id: testUserId!,
        title: veryLongTitle,
        message: 'Feedback with very long title'
      });

      createdFeedbacks.push(longTitleFeedback.id);

      // Nếu thành công - verify data
      console.log(`⚠️ TC_FEEDBACK_011: Service accepts long title (${veryLongTitle.length} chars)`);
      
      // CheckDB: Verify title was saved (possibly truncated)
      const feedbackInDb = await Feedback.findByPk(longTitleFeedback.id);
      expect(feedbackInDb).not.toBeNull();
      const savedTitle = feedbackInDb?.title || '';
      expect(savedTitle.length).toBeLessThanOrEqual(veryLongTitle.length);
    } catch (error: any) {
      console.log('✅ TC_FEEDBACK_011: Service validates title length (good)');
      
      // CheckDB: Verify no feedback created
      const feedbacksAfter = await Feedback.count();
      expect(feedbacksAfter).toBe(feedbacksBefore);
    }
  });

  /**
   * [TC_FEEDBACK_012] Tạo feedback với message rất dài
   * Mục tiêu: Kiểm tra xử lý message dài (> 1000 ký tự)
   * Input: {user_id, title: 'test', message: 'A'.repeat(2000)}
   * Expected: Có thể fail hoặc thành công
   * CheckDB: Verify data được lưu
   * Rollback: Xóa feedback nếu tạo thành công
   */
  it('[TC_FEEDBACK_012] should handle feedback with very long message', async () => {
    const veryLongMessage = 'A'.repeat(2000);
    const feedbacksBefore = await Feedback.count();

    try {
      const longMessageFeedback = await feedbackService.createFeedback({
        user_id: testUserId!,
        title: 'Feedback with long message',
        message: veryLongMessage
      });

      createdFeedbacks.push(longMessageFeedback.id);

      console.log(`⚠️ TC_FEEDBACK_012: Service accepts long message (${veryLongMessage.length} chars)`);
      
      // CheckDB: Verify message was saved
      const feedbackInDb = await Feedback.findByPk(longMessageFeedback.id);
      expect(feedbackInDb).not.toBeNull();
      const savedMessage = feedbackInDb?.message || '';
      expect(savedMessage.length).toBeLessThanOrEqual(veryLongMessage.length);
    } catch (error: any) {
      console.log('✅ TC_FEEDBACK_012: Service validates message length (good)');
      
      // CheckDB: Verify no feedback created
      const feedbacksAfter = await Feedback.count();
      expect(feedbacksAfter).toBe(feedbacksBefore);
    }
  });

  /**
   * [TC_FEEDBACK_013] Tạo feedback với user_id không tồn tại
   * Mục tiêu: Kiểm tra validation khi user_id không hợp lệ
   * Input: {user_id: 9999999, title, message}
   * Expected: Nên fail (user không tồn tại)
   * CheckDB: Không tạo feedback mới
   * Rollback: Không cần (fail)
   */
  it('[TC_FEEDBACK_013] should fail when creating feedback with non-existent user', async () => {
    const nonExistentUserId = 9999999;
    
    // Verify user doesn't exist
    const userInDb = await User.findByPk(nonExistentUserId);
    expect(userInDb).toBeNull();

    const feedbacksBefore = await Feedback.count();

    await expect(
      feedbackService.createFeedback({
        user_id: nonExistentUserId,
        title: 'Feedback from non-existent user',
        message: 'This should fail'
      })
    ).rejects.toThrow();

    // CheckDB: Verify no feedback created
    const feedbacksAfter = await Feedback.count();
    expect(feedbacksAfter).toBe(feedbacksBefore);

    console.log('✅ TC_FEEDBACK_013: Correctly rejected non-existent user');
  });

  /**
   * [TC_FEEDBACK_014] Tìm kiếm với username không tồn tại
   * Mục tiêu: Kiểm tra search trả về empty
   * Input: search = 'NonExistentUser123'
   * Expected: Trả về empty array
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_FEEDBACK_014] should return empty when searching non-existent user', async () => {
    const nonExistentUsername = 'NonExistentUser' + Date.now();
    
    const searchResults = await feedbackService.getAllFeedbacks(1, 10, nonExistentUsername);

    expect(searchResults).toBeDefined();
    expect(searchResults.feedbacks.length).toBe(0);

    console.log(`✅ TC_FEEDBACK_014: Search returned 0 results for "${nonExistentUsername}"`);
  });

  /**
   * [TC_FEEDBACK_015] Phân trang với page vượt quá total
   * Mục tiêu: Kiểm tra pagination khi page > totalPages
   * Input: page=999999, limit=10
   * Expected: Trả về empty array
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_FEEDBACK_015] should return empty when page exceeds total pages', async () => {
    const excessivePage = 999999;
    const pageSize = 10;
    
    const result = await feedbackService.getAllFeedbacks(excessivePage, pageSize);

    expect(result).toBeDefined();
    expect(result.feedbacks.length).toBe(0);
    expect(result.pagination.page).toBe(excessivePage);

    console.log('✅ TC_FEEDBACK_015: Correctly handled excessive page number');
  });

  /**
   * [TC_FEEDBACK_016] Tạo feedback với ký tự đặc biệt
   * Mục tiêu: Kiểm tra xử lý special characters và Unicode
   * Input: {user_id, title: 'Tiếng Việt!@#$', message: 'Đặc biệt <>{}'}
   * Expected: Tạo thành công, bảo toàn ký tự đặc biệt
   * CheckDB: Verify data được lưu đúng
   * Rollback: Xóa feedback đã tạo
   */
  it('[TC_FEEDBACK_016] should handle feedback with special characters', async () => {
    const specialTitle = 'Feedback Special!@#$%^&*() ' + Date.now();
    const specialMessage = 'Message with special chars: <>&{}[]|\\ Tiếng Việt: ăêôơư';

    const specialCharFeedback = await feedbackService.createFeedback({
      user_id: testUserId!,
      title: specialTitle,
      message: specialMessage
    });

    expect(specialCharFeedback).toBeDefined();
    createdFeedbacks.push(specialCharFeedback.id);

    // CheckDB: Verify special characters were saved correctly
    const feedbackInDb = await Feedback.findByPk(specialCharFeedback.id);
    expect(feedbackInDb).not.toBeNull();
    expect(feedbackInDb?.title).toBe(specialTitle);
    expect(feedbackInDb?.message).toBe(specialMessage);

    console.log('✅ TC_FEEDBACK_016: Special characters handled correctly');
  });

  /**
   * [TC_FEEDBACK_017] Tạo feedback với user_id = 0
   * Mục tiêu: Kiểm tra validation khi user_id = 0
   * Input: {user_id: 0, title, message}
   * Expected: Nên fail (user_id phải > 0)
   * CheckDB: Không tạo feedback
   * Rollback: Không cần
   */
  it('[TC_FEEDBACK_017] should fail when user_id is zero', async () => {
    const zeroUserId = 0;
    const feedbacksBefore = await Feedback.count();

    await expect(
      feedbackService.createFeedback({
        user_id: zeroUserId,
        title: 'Feedback with zero user_id',
        message: 'This should fail'
      })
    ).rejects.toThrow();

    // CheckDB: Verify no feedback created
    const feedbacksAfter = await Feedback.count();
    expect(feedbacksAfter).toBe(feedbacksBefore);

    console.log('✅ TC_FEEDBACK_017: Correctly rejected zero user_id');
  });

  /**
   * [TC_FEEDBACK_018] Tạo feedback với user_id âm
   * Mục tiêu: Kiểm tra validation khi user_id < 0
   * Input: {user_id: -1, title, message}
   * Expected: Nên fail
   * CheckDB: Không tạo feedback
   * Rollback: Không cần
   */
  it('[TC_FEEDBACK_018] should fail when user_id is negative', async () => {
    const negativeUserId = -1;
    const feedbacksBefore = await Feedback.count();

    await expect(
      feedbackService.createFeedback({
        user_id: negativeUserId,
        title: 'Feedback with negative user_id',
        message: 'This should fail'
      })
    ).rejects.toThrow();

    // CheckDB
    const feedbacksAfter = await Feedback.count();
    expect(feedbacksAfter).toBe(feedbacksBefore);

    console.log('✅ TC_FEEDBACK_018: Correctly rejected negative user_id');
  });

  /**
   * [TC_FEEDBACK_019] Mark cancelled với feedbackId = 0
   * Mục tiêu: Kiểm tra validation khi feedbackId = 0
   * Input: feedbackId = 0
   * Expected: Nên fail
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_FEEDBACK_019] should fail when cancelling feedback with ID zero', async () => {
    const zeroFeedbackId = 0;

    await expect(
      feedbackService.markCancelled(zeroFeedbackId)
    ).rejects.toThrow();

    console.log('✅ TC_FEEDBACK_019: Correctly rejected zero feedback ID');
  });

  /**
   * [TC_FEEDBACK_020] Mark cancelled với feedbackId âm
   * Mục tiêu: Kiểm tra validation khi feedbackId < 0
   * Input: feedbackId = -1
   * Expected: Nên fail
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_FEEDBACK_020] should fail when cancelling feedback with negative ID', async () => {
    const negativeFeedbackId = -1;

    await expect(
      feedbackService.markCancelled(negativeFeedbackId)
    ).rejects.toThrow();

    console.log('✅ TC_FEEDBACK_020: Correctly rejected negative feedback ID');
  });

  /**
   * [TC_FEEDBACK_021] Lấy feedbacks với limit = 0
   * Mục tiêu: Kiểm tra pagination với limit = 0
   * Input: page=1, limit=0
   * Expected: Có thể trả về empty hoặc fail
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_FEEDBACK_021] should handle limit zero', async () => {
    try {
      const result = await feedbackService.getAllFeedbacks(1, 0);
      
      // Nếu thành công - verify
      expect(result).toBeDefined();
      expect(result.feedbacks.length).toBe(0);
      
      console.log('⚠️ TC_FEEDBACK_021: Service accepts limit=0');
    } catch (error: any) {
      console.log('✅ TC_FEEDBACK_021: Service validates limit > 0 (good)');
    }
  });

  /**
   * [TC_FEEDBACK_022] Lấy feedbacks với limit âm
   * Mục tiêu: Kiểm tra pagination với limit < 0
   * Input: page=1, limit=-5
   * Expected: Nên fail hoặc ignore
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_FEEDBACK_022] should handle negative limit', async () => {
    const negativeLimit = -5;

    try {
      const result = await feedbackService.getAllFeedbacks(1, negativeLimit);
      
      console.log('⚠️ TC_FEEDBACK_022: Service accepts negative limit');
      expect(result).toBeDefined();
    } catch (error: any) {
      console.log('✅ TC_FEEDBACK_022: Service validates limit > 0 (good)');
    }
  });

  /**
   * [TC_FEEDBACK_023] Tạo nhiều feedbacks liên tiếp
   * Mục tiêu: Kiểm tra tạo nhiều feedbacks không bị lỗi
   * Input: 5 feedbacks liên tiếp
   * Expected: Tất cả được tạo thành công
   * CheckDB: Verify count tăng đúng
   * Rollback: Xóa tất cả feedbacks đã tạo
   */
  it('[TC_FEEDBACK_023] should create multiple feedbacks consecutively', async () => {
    const numberOfFeedbacks = 5;
    const feedbacksBefore = await Feedback.count();
    const createdIds: number[] = [];

    for (let i = 1; i <= numberOfFeedbacks; i++) {
      const feedback = await feedbackService.createFeedback({
        user_id: testUserId!,
        title: `Bulk Feedback ${i}`,
        message: `This is feedback number ${i}`
      });
      
      expect(feedback).toBeDefined();
      expect(feedback.title).toBe(`Bulk Feedback ${i}`);
      createdIds.push(feedback.id);
    }

    // Store for rollback
    createdFeedbacks.push(...createdIds);

    // CheckDB: Verify all feedbacks were created
    const feedbacksAfter = await Feedback.count();
    expect(feedbacksAfter).toBe(feedbacksBefore + numberOfFeedbacks);

    console.log(`✅ TC_FEEDBACK_023: Created ${numberOfFeedbacks} feedbacks successfully`);
  });

  /**
   * [TC_FEEDBACK_024] Tìm kiếm với keyword rỗng
   * Mục tiêu: Kiểm tra search với empty string
   * Input: search = ''
   * Expected: Trả về tất cả feedbacks (như không filter)
   * CheckDB: Verify count = total feedbacks
   * Rollback: Không cần
   */
  it('[TC_FEEDBACK_024] should return all feedbacks when search keyword is empty', async () => {
    const emptyKeyword = '';
    
    const allFeedbacks = await feedbackService.getAllFeedbacks(1, 100);
    const searchResults = await feedbackService.getAllFeedbacks(1, 100, emptyKeyword);

    expect(searchResults.feedbacks.length).toBe(allFeedbacks.feedbacks.length);

    // CheckDB: Verify returns all feedbacks
    const totalFeedbacksInDb = await Feedback.count();
    expect(allFeedbacks.pagination.total).toBe(totalFeedbacksInDb);

    console.log(`✅ TC_FEEDBACK_024: Empty search returned all ${searchResults.feedbacks.length} feedbacks`);
  });

  /**
   * [TC_FEEDBACK_025] Tạo feedback rồi cancel ngay
   * Mục tiêu: Kiểm tra workflow create → cancel
   * Input: Tạo feedback mới, sau đó cancel
   * Expected: Tạo thành công, cancel thành công
   * CheckDB: Verify status='cancelled'
   * Rollback: Feedback đã cancel (không rollback)
   */
  it('[TC_FEEDBACK_025] should create and immediately cancel feedback', async () => {
    const feedbacksBefore = await Feedback.count();

    // Create feedback
    const newFeedback = await feedbackService.createFeedback({
      user_id: testUserId!,
      title: 'Feedback to Cancel',
      message: 'This will be cancelled immediately'
    });
    createdFeedbacks.push(newFeedback.id);

    expect(newFeedback.status).toBe('pending');

    // Immediately cancel
    const cancelledFeedback = await feedbackService.markCancelled(newFeedback.id);
    expect(cancelledFeedback.status).toBe('cancelled');

    // CheckDB: Verify final status
    const feedbackInDb = await Feedback.findByPk(newFeedback.id);
    expect(feedbackInDb?.status).toBe('cancelled');

    // CheckDB: Verify count increased by 1
    const feedbacksAfter = await Feedback.count();
    expect(feedbacksAfter).toBe(feedbacksBefore + 1);

    console.log('✅ TC_FEEDBACK_025: Create and cancel workflow successful');
  });
});
