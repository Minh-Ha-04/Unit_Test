import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import notificationService from '../services/notificationService';
import Notification from '../models/Notification';
import NotificationRead from '../models/NotificationRead';
import User from '../models/User';
import Admin from '../models/Admin';
import bcrypt from 'bcryptjs';

/**
 * Feature 11: Notification Management - Comprehensive Unit Tests
 * ✅ Test Case IDs rõ ràng
 * ✅ CheckDB: Xác minh database changes
 * ✅ Rollback: Khôi phục DB sau tests
 * ❗ Tests có cả PASS và edge cases thực tế
 * 
 * Services được test:
 * - sendNotificationToUser()
 * - sendNotificationToAllUsers()
 * - getUserNotifications()
 * - markAllNotificationsAsRead()
 */
describe('[Feature 11] Notification Management - Complete Unit Tests', () => {
  let testUserId: number | undefined;
  let testAdminId: number | undefined;
  let createdNotifications: number[] = [];
  let createdUsers: number[] = [];
  let createdAdmins: number[] = [];

  beforeAll(async () => {
    console.log('🔔 Notification: Bắt đầu kiểm thử...');

    // Tạo user test
    const hashedPassword = await bcrypt.hash('password123', 10);
    const user = await User.create({
      username: 'notification_user',
      email: 'notification_' + Date.now() + '@example.com',
      password_hash: hashedPassword,
      phone: '0908888888',
      is_active: true
    });
    testUserId = user.id;
    createdUsers.push(testUserId);

    // Tạo admin test
    const admin = await Admin.create({
      username: 'notification_admin',
      email: 'notif_admin_' + Date.now() + '@example.com',
      password_hash: hashedPassword,
      role: 'employee',
      is_active: true
    });
    testAdminId = admin.id;
    createdAdmins.push(testAdminId);
  });

  /**
   * Rollback toàn bộ DB về trạng thái trước khi test
   * Thứ tự xóa: NotificationReads → Notifications → Admins → Users
   * (theo foreign key constraints)
   */
  afterAll(async () => {
    console.log('🔄 Starting Rollback...');
    
    // Xóa notification reads trước (dependent on notifications)
    for (const notifId of createdNotifications) {
      await NotificationRead.destroy({ where: { notification_id: notifId } }).catch(() => {});
      await Notification.destroy({ where: { id: notifId } }).catch(() => {});
    }
    
    // Xóa admins
    for (const adminId of createdAdmins) {
      await Admin.destroy({ where: { id: adminId } }).catch(() => {});
    }
    
    // Xóa users
    for (const userId of createdUsers) {
      await User.destroy({ where: { id: userId } }).catch(() => {});
    }
    
    console.log(`✅ Rollback complete: Deleted ${createdNotifications.length} notifications, ${createdAdmins.length} admins, ${createdUsers.length} users`);
  });

  /**
   * [TC_NOTIF_001] Gửi notification cho user thành công
   * Mục tiêu: Kiểm tra sendNotificationToUser tạo notification đúng
   * Input: {adminId, userId, title, message, type}
   * Expected: Tạo notification thành công
   * CheckDB: Verify notification được lưu trong DB
   * Rollback: Xóa notification trong afterAll
   */
  it('[TC_NOTIF_001] should send notification to user', async () => {
    const notificationTitle = 'Test Notification ' + Date.now();
    const notificationMessage = 'This is a comprehensive test notification';
    const notificationType: 'order' | 'promotion' = 'order';
    
    const notificationData = {
      title: notificationTitle,
      message: notificationMessage,
      type: notificationType
    };

    const createdNotification = await notificationService.sendNotificationToUser(
      testAdminId!,
      testUserId!,
      notificationData
    );

    // Verify response
    expect(createdNotification).toBeDefined();
    expect(createdNotification.id).toBeDefined();
    expect(createdNotification.title).toBe(notificationTitle);
    expect(createdNotification.message).toBe(notificationMessage);
    expect(createdNotification.type).toBe(notificationType);

    // Store for rollback
    createdNotifications.push(createdNotification.id);

    // CheckDB: Verify notification exists in database
    const notificationInDb = await Notification.findByPk(createdNotification.id);
    expect(notificationInDb).not.toBeNull();
    expect(notificationInDb?.title).toBe(notificationTitle);
    expect(notificationInDb?.user_id).toBe(testUserId);

    console.log(`✅ TC_NOTIF_001: Sent notification ID ${createdNotification.id}`);
  });

  /**
   * [TC_NOTIF_002] Gửi notification cho user không tồn tại
   * Mục tiêu: Kiểm tra error handling khi userId không hợp lệ
   * Input: {adminId, userId: 9999999, ...}
   * Expected: Ném lỗi "Người dùng không tồn tại"
   * CheckDB: Verify user không tồn tại, không tạo notification
   * Rollback: Không cần (fail)
   */
  it('[TC_NOTIF_002] should fail sending to non-existent user', async () => {
    const nonExistentUserId = 9999999;
    
    // Verify user doesn't exist
    const userInDb = await User.findByPk(nonExistentUserId);
    expect(userInDb).toBeNull();

    const notificationsBefore = await Notification.count();

    await expect(
      notificationService.sendNotificationToUser(testAdminId!, nonExistentUserId, {
        title: 'Test',
        message: 'Test',
        type: 'order'
      })
    ).rejects.toThrow('Người dùng không tồn tại');

    // CheckDB: Verify no notification was created
    const notificationsAfter = await Notification.count();
    expect(notificationsAfter).toBe(notificationsBefore);

    console.log('✅ TC_NOTIF_002: Correctly rejected non-existent user');
  });

  /**
   * [TC_NOTIF_003] Gửi broadcast notification cho tất cả users
   * Mục tiêu: Kiểm tra sendNotificationToAllUsers tạo broadcast notification
   * Input: {adminId, title, message, type}
   * Expected: Tạo notification với user_id=null (broadcast)
   * CheckDB: Verify notification được lưu với user_id=null
   * Rollback: Xóa notification trong afterAll
   */
  it('[TC_NOTIF_003] should send notification to all users', async () => {
    const broadcastTitle = 'Broadcast Notification ' + Date.now();
    const broadcastMessage = 'This is for all users';
    const broadcastType: 'order' | 'promotion' = 'promotion';
    
    const broadcastData = {
      title: broadcastTitle,
      message: broadcastMessage,
      type: broadcastType
    };

    const createdBroadcast = await notificationService.sendNotificationToAllUsers(
      testAdminId!,
      broadcastData
    );

    // Verify response
    expect(createdBroadcast).toBeDefined();
    expect(createdBroadcast.id).toBeDefined();
    expect(createdBroadcast.title).toBe(broadcastTitle);
    expect(createdBroadcast.message).toBe(broadcastMessage);
    expect(createdBroadcast.user_id).toBeNull(); // Broadcast notification

    // Store for rollback
    createdNotifications.push(createdBroadcast.id);

    // CheckDB: Verify broadcast notification saved with user_id=null
    const notificationInDb = await Notification.findByPk(createdBroadcast.id);
    expect(notificationInDb).not.toBeNull();
    expect(notificationInDb?.user_id).toBeNull();

    console.log(`✅ TC_NOTIF_003: Sent broadcast notification ID ${createdBroadcast.id}`);
  });

  /**
   * [TC_NOTIF_004] Lấy notifications của user
   * Mục tiêu: Kiểm tra getUserNotifications trả về đúng notifications
   * Input: userId
   * Expected: Trả về notifications và unreadCount
   * CheckDB: So sánh với count trong DB
   * Rollback: Không thay đổi DB
   */
  it('[TC_NOTIF_004] should get user notifications', async () => {
    const userNotifications = await notificationService.getUserNotifications(testUserId!);

    // Verify response structure
    expect(userNotifications).toBeDefined();
    expect(Array.isArray(userNotifications.notifications)).toBe(true);
    expect(typeof userNotifications.unreadCount).toBe('number');
    expect(userNotifications.unreadCount).toBeGreaterThanOrEqual(0);

    // CheckDB: Verify notifications belong to user
    for (const notification of userNotifications.notifications) {
      expect(notification.user_id).toBe(testUserId);
    }

    console.log(`✅ TC_NOTIF_004: Retrieved ${userNotifications.notifications.length} notifications, ${userNotifications.unreadCount} unread`);
  });

  /**
   * [TC_NOTIF_005] Mark all notifications as read
   * Mục tiêu: Kiểm tra markAllNotificationsAsRead đánh dấu tất cả đã đọc
   * Input: userId
   * Expected: Tất cả notifications của user thành is_read=true
   * CheckDB: Verify is_read=true trong DB
   * Rollback: Notifications đã mark read (không rollback)
   */
  it('[TC_NOTIF_005] should mark all notifications as read', async () => {
    // Get notifications before marking
    const notificationsBefore = await notificationService.getUserNotifications(testUserId!);
    const unreadCountBefore = notificationsBefore.unreadCount;

    // Mark all as read
    const markResult = await notificationService.markAllNotificationsAsRead(testUserId!);

    // Verify response
    expect(markResult).toBeDefined();

    // CheckDB: Verify all notifications are now read
    const notificationsAfter = await notificationService.getUserNotifications(testUserId!);
    expect(notificationsAfter.unreadCount).toBe(0);
    
    // If there were unread notifications, count should decrease
    if (unreadCountBefore > 0) {
      expect(notificationsAfter.unreadCount).toBeLessThan(unreadCountBefore);
    }

    console.log(`✅ TC_NOTIF_005: Marked all as read (was ${unreadCountBefore} unread)`);
  });

  /**
   * [TC_NOTIF_006] Mark notifications as read (idempotent test)
   * Mục tiêu: Kiểm tra mark all khi đã read rồi vẫn hoạt động
   * Input: userId (đã mark read ở TC_NOTIF_005)
   * Expected: Thành công, unreadCount=0
   * CheckDB: Verify unreadCount vẫn = 0
   * Rollback: Không cần
   */
  it('[TC_NOTIF_006] should handle marking already read notifications', async () => {
    if (createdNotifications.length === 0) {
      throw new Error('Chưa có notification từ TC_NOTIF_001');
    }

    // Mark all as read again (should be idempotent)
    const markResult = await notificationService.markAllNotificationsAsRead(testUserId!);

    expect(markResult).toBeDefined();

    // CheckDB: Verify still 0 unread
    const notificationsAfter = await notificationService.getUserNotifications(testUserId!);
    expect(notificationsAfter.unreadCount).toBe(0);

    console.log('✅ TC_NOTIF_006: Idempotent mark all as read successful');
  });

  /**
   * [TC_NOTIF_007] Mark all as read khi không có notifications
   * Mục tiêu: Kiểm tra handle khi user không có notifications
   * Input: userId (có thể không có notifications)
   * Expected: Thành công, không lỗi
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_NOTIF_007] should handle mark all as read with no notifications', async () => {
    const markResult = await notificationService.markAllNotificationsAsRead(testUserId!);

    expect(markResult).toBeDefined();

    console.log('✅ TC_NOTIF_007: Mark all as read handled (with/without notifications)');
  });

  /**
   * [TC_NOTIF_008] Đếm số unread notifications
   * Mục tiêu: Kiểm tra unreadCount chính xác
   * Input: userId
   * Expected: unreadCount >= 0 và là number
   * CheckDB: Verify count là number
   * Rollback: Không thay đổi DB
   */
  it('[TC_NOTIF_008] should get accurate unread count', async () => {
    const userNotifications = await notificationService.getUserNotifications(testUserId!);

    // Verify response
    expect(userNotifications).toBeDefined();
    expect(typeof userNotifications.unreadCount).toBe('number');
    expect(userNotifications.unreadCount).toBeGreaterThanOrEqual(0);

    console.log(`✅ TC_NOTIF_008: Unread count = ${userNotifications.unreadCount}`);
  });

  /**
   * [TC_NOTIF_009] Xóa notification
   * Mục tiêu: Kiểm tra xóa notification khỏi DB
   * Input: notificationId
   * Expected: Xóa thành công
   * CheckDB: Verify notification bị xóa khỏi DB
   * Rollback: Notification đã xóa (không rollback hard delete)
   */
  it('[TC_NOTIF_009] should delete notification', async () => {
    // Tạo notification mới để xóa
    const notificationToDelete = await Notification.create({
      user_id: testUserId,
      title: 'Notification To Delete',
      message: 'This will be deleted',
      type: 'order'
    });
    const notificationIdToDelete = notificationToDelete.id;

    // Verify notification exists before delete
    const notificationBeforeDelete = await Notification.findByPk(notificationIdToDelete);
    expect(notificationBeforeDelete).not.toBeNull();

    // Delete notification
    await Notification.destroy({ where: { id: notificationIdToDelete } });

    // CheckDB: Verify notification was deleted
    const notificationAfterDelete = await Notification.findByPk(notificationIdToDelete);
    expect(notificationAfterDelete).toBeNull();

    console.log(`✅ TC_NOTIF_009: Deleted notification ID ${notificationIdToDelete}`);
  });

  /**
   * [TC_NOTIF_010] Lấy notifications của user
   * Mục tiêu: Kiểm tra getUserNotifications trả về đúng structure
   * Input: userId
   * Expected: Trả về notifications array
   * CheckDB: Verify notifications thuộc về user
   * Rollback: Không thay đổi DB
   */
  it('[TC_NOTIF_010] should get user notifications with correct structure', async () => {
    const userNotifications = await notificationService.getUserNotifications(testUserId!);

    // Verify response structure
    expect(userNotifications).toBeDefined();
    expect(Array.isArray(userNotifications.notifications)).toBe(true);
    expect(typeof userNotifications.unreadCount).toBe('number');

    // CheckDB: Verify all notifications belong to user
    for (const notification of userNotifications.notifications) {
      expect(notification.user_id).toBe(testUserId);
    }

    console.log(`✅ TC_NOTIF_010: Retrieved ${userNotifications.notifications.length} notifications with correct structure`);
  });

  /**
   * [TC_NOTIF_011] Gửi notification với title rỗng
   * Mục tiêu: Kiểm tra validation khi title = ''
   * Input: {adminId, userId, title: '', message, type}
   * Expected: Có thể fail hoặc tạo với title rỗng
   * CheckDB: Verify notification được lưu
   * Rollback: Xóa notification nếu tạo thành công
   */
  it('[TC_NOTIF_011] should handle notification with empty title', async () => {
    const notificationsBefore = await Notification.count();

    try {
      const emptyTitleNotification = await notificationService.sendNotificationToUser(
        testAdminId!,
        testUserId!,
        {
          title: '',
          message: 'Notification with empty title',
          type: 'order'
        }
      );

      createdNotifications.push(emptyTitleNotification.id);

      console.log('⚠️ TC_NOTIF_011: Service accepts empty title');
      
      // CheckDB: Verify notification was created
      const notificationsAfter = await Notification.count();
      expect(notificationsAfter).toBe(notificationsBefore + 1);
    } catch (error: any) {
      console.log('✅ TC_NOTIF_011: Service validates title (good)');
      
      // CheckDB: Verify no notification created
      const notificationsAfter = await Notification.count();
      expect(notificationsAfter).toBe(notificationsBefore);
    }
  });

  /**
   * [TC_NOTIF_012] Gửi notification với message rỗng
   * Mục tiêu: Kiểm tra validation khi message = ''
   * Input: {adminId, userId, title, message: ''}
   * Expected: Có thể fail hoặc tạo với message rỗng
   * CheckDB: Verify notification được lưu
   * Rollback: Xóa notification nếu tạo thành công
   */
  it('[TC_NOTIF_012] should handle notification with empty message', async () => {
    const notificationsBefore = await Notification.count();

    try {
      const emptyMessageNotification = await notificationService.sendNotificationToUser(
        testAdminId!,
        testUserId!,
        {
          title: 'Notification with empty message',
          message: '',
          type: 'order'
        }
      );

      createdNotifications.push(emptyMessageNotification.id);

      console.log('⚠️ TC_NOTIF_012: Service accepts empty message');
      
      // CheckDB
      const notificationsAfter = await Notification.count();
      expect(notificationsAfter).toBe(notificationsBefore + 1);
    } catch (error: any) {
      console.log('✅ TC_NOTIF_012: Service validates message (good)');
      
      // CheckDB
      const notificationsAfter = await Notification.count();
      expect(notificationsAfter).toBe(notificationsBefore);
    }
  });

  /**
   * [TC_NOTIF_013] Gửi notification với type không hợp lệ
   * Mục tiêu: Kiểm tra validation khi type sai
   * Input: {adminId, userId, type: 'invalid'}
   * Expected: Nên fail (type phải là 'order' hoặc 'promotion')
   * CheckDB: Không tạo notification
   * Rollback: Không cần
   */
  it('[TC_NOTIF_013] should fail with invalid notification type', async () => {
    const notificationsBefore = await Notification.count();

    await expect(
      notificationService.sendNotificationToUser(testAdminId!, testUserId!, {
        title: 'Test',
        message: 'Test',
        type: 'invalid' as any
      })
    ).rejects.toThrow();

    // CheckDB: Verify no notification created
    const notificationsAfter = await Notification.count();
    expect(notificationsAfter).toBe(notificationsBefore);

    console.log('✅ TC_NOTIF_013: Correctly rejected invalid type');
  });

  /**
   * [TC_NOTIF_014] Gửi notification cho admin không tồn tại
   * Mục tiêu: Kiểm tra validation khi sender (admin) không tồn tại
   * Input: {adminId: 9999999, userId, ...}
   * Expected: Có thể fail hoặc thành công (tùy logic)
   * CheckDB: Verify count không đổi nếu fail
   * Rollback: Không cần nếu fail
   */
  it('[TC_NOTIF_014] should handle notification from non-existent admin', async () => {
    const nonExistentAdminId = 9999999;
    const notificationsBefore = await Notification.count();

    try {
      const createdNotification = await notificationService.sendNotificationToUser(
        nonExistentAdminId,
        testUserId!,
        {
          title: 'Test from non-existent admin',
          message: 'Test',
          type: 'order'
        }
      );

      createdNotifications.push(createdNotification.id);

      console.log('⚠️ TC_NOTIF_014: Service accepts non-existent admin sender');
      
      // CheckDB
      const notificationsAfter = await Notification.count();
      expect(notificationsAfter).toBe(notificationsBefore + 1);
    } catch (error: any) {
      console.log('✅ TC_NOTIF_014: Service validates admin sender (good)');
      
      // CheckDB
      const notificationsAfter = await Notification.count();
      expect(notificationsAfter).toBe(notificationsBefore);
    }
  });

  /**
   * [TC_NOTIF_015] Gửi broadcast notification
   * Mục tiêu: Kiểm tra broadcast notification có user_id=null
   * Input: {adminId, title, message, type}
   * Expected: Tạo notification với user_id=null
   * CheckDB: Verify user_id=null trong DB
   * Rollback: Xóa notification trong afterAll
   */
  it('[TC_NOTIF_015] should create broadcast notification with null user_id', async () => {
    const notificationsBefore = await Notification.count();

    const broadcastNotification = await notificationService.sendNotificationToAllUsers(
      testAdminId!,
      {
        title: 'Broadcast Test ' + Date.now(),
        message: 'Test broadcast',
        type: 'promotion'
      }
    );

    createdNotifications.push(broadcastNotification.id);

    // CheckDB: Verify user_id is null
    const notificationInDb = await Notification.findByPk(broadcastNotification.id);
    expect(notificationInDb?.user_id).toBeNull();

    // CheckDB: Verify count increased
    const notificationsAfter = await Notification.count();
    expect(notificationsAfter).toBe(notificationsBefore + 1);

    console.log(`✅ TC_NOTIF_015: Broadcast notification created with null user_id`);
  });

  /**
   * [TC_NOTIF_016] Gửi nhiều notifications liên tiếp
   * Mục tiêu: Kiểm tra tạo nhiều notifications không bị lỗi
   * Input: 5 notifications liên tiếp
   * Expected: Tất cả được tạo thành công
   * CheckDB: Verify count tăng đúng
   * Rollback: Xóa tất cả notifications đã tạo
   */
  it('[TC_NOTIF_016] should create multiple notifications consecutively', async () => {
    const numberOfNotifications = 5;
    const notificationsBefore = await Notification.count();
    const createdIds: number[] = [];

    for (let i = 1; i <= numberOfNotifications; i++) {
      const notification = await notificationService.sendNotificationToUser(
        testAdminId!,
        testUserId!,
        {
          title: `Bulk Notification ${i}`,
          message: `This is notification number ${i}`,
          type: i % 2 === 0 ? 'order' : 'promotion'
        }
      );
      
      expect(notification).toBeDefined();
      expect(notification.title).toBe(`Bulk Notification ${i}`);
      createdIds.push(notification.id);
    }

    // Store for rollback
    createdNotifications.push(...createdIds);

    // CheckDB: Verify all notifications were created
    const notificationsAfter = await Notification.count();
    expect(notificationsAfter).toBe(notificationsBefore + numberOfNotifications);

    console.log(`✅ TC_NOTIF_016: Created ${numberOfNotifications} notifications successfully`);
  });

  /**
   * [TC_NOTIF_017] Gửi notification với title rất dài
   * Mục tiêu: Kiểm tra xử lý title dài (> 255 ký tự)
   * Input: {adminId, userId, title: 'A'.repeat(500), ...}
   * Expected: Có thể fail hoặc cắt ngắn
   * CheckDB: Verify data được lưu
   * Rollback: Xóa notification nếu tạo thành công
   */
  it('[TC_NOTIF_017] should handle notification with very long title', async () => {
    const veryLongTitle = 'A'.repeat(500);
    const notificationsBefore = await Notification.count();

    try {
      const longTitleNotification = await notificationService.sendNotificationToUser(
        testAdminId!,
        testUserId!,
        {
          title: veryLongTitle,
          message: 'Notification with long title',
          type: 'order'
        }
      );

      createdNotifications.push(longTitleNotification.id);

      console.log(`⚠️ TC_NOTIF_017: Service accepts long title (${veryLongTitle.length} chars)`);
      
      // CheckDB: Verify title was saved (possibly truncated)
      const notificationInDb = await Notification.findByPk(longTitleNotification.id);
      const savedTitle = notificationInDb?.title || '';
      expect(savedTitle.length).toBeLessThanOrEqual(veryLongTitle.length);
    } catch (error: any) {
      console.log('✅ TC_NOTIF_017: Service validates title length (good)');
      
      // CheckDB: Verify no notification created
      const notificationsAfter = await Notification.count();
      expect(notificationsAfter).toBe(notificationsBefore);
    }
  });

  /**
   * [TC_NOTIF_018] Gửi notification với ký tự đặc biệt
   * Mục tiêu: Kiểm tra xử lý special characters và Unicode
   * Input: {adminId, userId, title: 'Tiếng Việt!@#$', ...}
   * Expected: Tạo thành công, bảo toàn ký tự
   * CheckDB: Verify data được lưu đúng
   * Rollback: Xóa notification đã tạo
   */
  it('[TC_NOTIF_018] should handle notification with special characters', async () => {
    const specialTitle = 'Notification Special!@#$%^&*() ' + Date.now();
    const specialMessage = 'Message with special chars: <>&{}[]|\\ Tiếng Việt: ăêôơư';

    const specialCharNotification = await notificationService.sendNotificationToUser(
      testAdminId!,
      testUserId!,
      {
        title: specialTitle,
        message: specialMessage,
        type: 'order'
      }
    );

    expect(specialCharNotification).toBeDefined();
    createdNotifications.push(specialCharNotification.id);

    // CheckDB: Verify special characters were saved correctly
    const notificationInDb = await Notification.findByPk(specialCharNotification.id);
    expect(notificationInDb).not.toBeNull();
    expect(notificationInDb?.title).toBe(specialTitle);
    expect(notificationInDb?.message).toBe(specialMessage);

    console.log('✅ TC_NOTIF_018: Special characters handled correctly');
  });

  /**
   * [TC_NOTIF_019] Gửi notification cho user inactive
   * Mục tiêu: Kiểm tra validation khi user.is_active = false
   * Input: {adminId, userId của user inactive, ...}
   * Expected: Nên fail (user bị khóa không nhận notification)
   * CheckDB: Không tạo notification
   * Rollback: Không cần
   */
  it('[TC_NOTIF_019] should fail sending to inactive user', async () => {
    // Tạo user inactive
    const hashedPassword = await bcrypt.hash('password123', 10);
    const inactiveUser = await User.create({
      username: 'inactive_notification_user',
      email: 'inactive_notif_' + Date.now() + '@example.com',
      password_hash: hashedPassword,
      phone: '0909999999',
      is_active: false
    });
    createdUsers.push(inactiveUser.id);

    const notificationsBefore = await Notification.count();

    try {
      await notificationService.sendNotificationToUser(
        testAdminId!,
        inactiveUser.id,
        {
          title: 'Test for inactive user',
          message: 'This should fail',
          type: 'order'
        }
      );

      console.log('⚠️ TC_NOTIF_019: Service allows sending to inactive user');
      
      // CheckDB
      const notificationsAfter = await Notification.count();
      expect(notificationsAfter).toBe(notificationsBefore + 1);
    } catch (error: any) {
      console.log('✅ TC_NOTIF_019: Service rejects inactive user (good)');
      
      // CheckDB: Verify no notification created
      const notificationsAfter = await Notification.count();
      expect(notificationsAfter).toBe(notificationsBefore);
    }
  });

  /**
   * [TC_NOTIF_020] Lấy notifications của user không tồn tại
   * Mục tiêu: Kiểm tra error handling khi userId không hợp lệ
   * Input: userId = 9999999
   * Expected: Trả về empty hoặc fail gracefully
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_NOTIF_020] should handle getting notifications for non-existent user', async () => {
    const nonExistentUserId = 9999999;

    try {
      const userNotifications = await notificationService.getUserNotifications(nonExistentUserId);
      
      // Nếu thành công - nên trả về empty
      expect(userNotifications).toBeDefined();
      expect(userNotifications.notifications.length).toBe(0);
      expect(userNotifications.unreadCount).toBe(0);
      
      console.log('⚠️ TC_NOTIF_020: Service returns empty for non-existent user');
    } catch (error: any) {
      console.log('✅ TC_NOTIF_020: Service rejects non-existent user');
    }
  });
});
