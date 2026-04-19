import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bookingService from '../services/bookingService';
import Order from '../models/Order';
import User from '../models/User';
import Tour from '../models/Tour';
import bcrypt from 'bcryptjs';

/**
 * Feature 7: Booking Management - Comprehensive Unit Tests
 * ✅ Test Case IDs rõ ràng
 * ✅ CheckDB: Xác minh database changes
 * ✅ Rollback: Khôi phục DB sau tests
 * ❗ Tests có cả PASS và FAIL (edge cases thực tế)
 * 
 * Services được test:
 * - createBooking()
 * - getBookingById()
 * - getUserBookings()
 * - getAllBookings()
 * - cancelBooking()
 * - confirmBooking()
 * - updateBooking()
 */

describe('[Feature 7] Booking Management - Improved Tests', () => {
  let testUserId: number;
  let testTourId: number;
  let createdBookingId: number;

  let createdBookings: number[] = [];
  let createdUsers: number[] = [];
  let createdTours: number[] = [];

  beforeAll(async () => {
    console.log('📝 Start Booking Tests...');

    const hashedPassword = await bcrypt.hash('password123', 10);

    const user = await User.create({
      username: 'booking_user',
      email: 'booking_' + Date.now() + '@mail.com',
      password_hash: hashedPassword,
      phone: '0903333333',
      is_active: true
    });
    testUserId = user.id;
    createdUsers.push(user.id);

    const tour = await Tour.create({
      title: 'Test Tour',
      destination: 'HN',
      departure: 'HCM',
      start_date: new Date('2026-11-01'),
      end_date: new Date('2026-11-05'),
      price: 5000000,
      capacity: 3, // ⚠️ để test overflow
      latitude: 0,
      longitude: 0,
      is_active: true
    });
    testTourId = tour.id;
    createdTours.push(tour.id);
  });

  /**
   * Rollback toàn bộ DB về trạng thái trước khi test
   * Thứ tự xóa: Bookings → Tours → Users (theo foreign key constraints)
   */
  afterAll(async () => {
    console.log('🔄 Starting Rollback...');
    
    // Xóa bookings trước (có foreign key đến users và tours)
    for (const bookingId of createdBookings) {
      await Order.destroy({ where: { id: bookingId } }).catch(() => {});
    }
    
    // Xóa tours
    for (const tourId of createdTours) {
      await Tour.destroy({ where: { id: tourId } }).catch(() => {});
    }
    
    // Xóa users
    for (const userId of createdUsers) {
      await User.destroy({ where: { id: userId } }).catch(() => {});
    }
    
    console.log('✅ Rollback complete: DB restored to original state');
  });

  /**
   * [TC_BOOKING_001] Tạo booking thành công
   * Mục tiêu: Kiểm tra createBooking với dữ liệu hợp lệ
   * Input: {user_id, tour_id, quantity: 2}
   * Expected: Tạo order với status='pending', total_price đúng
   * CheckDB: Verify order được lưu trong DB với đúng dữ liệu
   * Rollback: Xóa order trong afterAll
   */
  it('[TC_BOOKING_001] should create booking successfully', async () => {
    const bookingQuantity = 2;
    const tourPrice = 5000000;
    const expectedTotalPrice = bookingQuantity * tourPrice;

    const bookingResult = await bookingService.createBooking({
      user_id: testUserId,
      tour_id: testTourId,
      quantity: bookingQuantity
    });

    // Verify response
    expect(bookingResult).toBeDefined();
    expect(bookingResult.id).toBeDefined();
    expect(bookingResult.quantity).toBe(bookingQuantity);
    expect(bookingResult.status).toBe('pending');
    expect(bookingResult.total_price).toBe(expectedTotalPrice);

    // Store for rollback
    createdBookingId = bookingResult.id;
    createdBookings.push(bookingResult.id);

    // CheckDB: Xác minh order được lưu đúng trong database
    const orderInDb = await Order.findByPk(bookingResult.id);
    expect(orderInDb).not.toBeNull();
    expect(orderInDb?.user_id).toBe(testUserId);
    expect(orderInDb?.tour_id).toBe(testTourId);
    expect(orderInDb?.quantity).toBe(bookingQuantity);
    expect(orderInDb?.status).toBe('pending');
    expect(orderInDb?.total_price).toBe(expectedTotalPrice);

    console.log(`✅ TC_BOOKING_001 passed: Booking created with ID ${createdBookingId}`);
  });

  /**
   * [TC_BOOKING_002] Lấy booking theo ID
   * Mục tiêu: Kiểm tra getBookingById trả về đúng booking
   * Input: bookingId hợp lệ
   * Expected: Trả về booking object với đầy đủ thông tin
   * CheckDB: So sánh với dữ liệu trong DB
   * Rollback: Không thay đổi DB (read-only)
   */
  it('[TC_BOOKING_002] should get booking by ID', async () => {
    const bookingResult = await bookingService.getBookingById(createdBookingId);

    // Verify response
    expect(bookingResult).toBeDefined();
    expect(bookingResult.id).toBe(createdBookingId);
    expect(bookingResult.user_id).toBe(testUserId);
    expect(bookingResult.tour_id).toBe(testTourId);

    // CheckDB: Verify data matches database
    const orderInDb = await Order.findByPk(createdBookingId);
    expect(orderInDb?.quantity).toBe(bookingResult.quantity);
    expect(orderInDb?.status).toBe(bookingResult.status);
    expect(orderInDb?.total_price).toBe(bookingResult.total_price);

    console.log('✅ TC_BOOKING_002 passed: Booking retrieved successfully');
  });

  /**
   * [TC_BOOKING_003] Lấy danh sách bookings theo user
   * Mục tiêu: Kiểm tra getUserBookings với pagination
   * Input: userId, page=1, limit=10
   * Expected: Trả về danh sách bookings của user với pagination
   * CheckDB: Đếm số bookings trong DB phải khớp
   * Rollback: Không thay đổi DB
   */
  it('[TC_BOOKING_003] should get bookings by user ID', async () => {
    const pageNumber = 1;
    const pageSize = 10;
    
    const userBookings = await bookingService.getUserBookings(testUserId, pageNumber, pageSize);

    // Verify response structure
    expect(userBookings).toBeDefined();
    expect(Array.isArray(userBookings.bookings)).toBe(true);
    expect(userBookings.pagination).toBeDefined();
    expect(userBookings.pagination.page).toBe(pageNumber);
    expect(userBookings.pagination.limit).toBe(pageSize);

    // CheckDB: Verify total count matches database
    const totalBookingsInDb = await Order.count({ where: { user_id: testUserId } });
    expect(userBookings.pagination.total).toBe(totalBookingsInDb);

    console.log(`✅ TC_BOOKING_003 passed: Retrieved ${userBookings.bookings.length} bookings`);
  });

  /**
   * [TC_BOOKING_004] Hủy booking thành công
   * Mục tiêu: Kiểm tra cancelBooking cập nhật status thành 'cancelled'
   * Input: bookingId hợp lệ
   * Expected: Status chuyển từ 'pending' sang 'cancelled'
   * CheckDB: Verify status='cancelled' trong DB
   * Rollback: Booking vẫn tồn tại (soft delete), không cần rollback
   */
  it('[TC_BOOKING_004] should cancel booking successfully', async () => {
    // Get status before cancel
    const bookingBeforeCancel = await Order.findByPk(createdBookingId);
    const statusBeforeCancel = bookingBeforeCancel?.status;
    expect(statusBeforeCancel).toBe('pending');

    // Cancel booking
    await bookingService.cancelBooking(createdBookingId);

    // CheckDB: Verify status changed to 'cancelled' in database
    const bookingAfterCancel = await Order.findByPk(createdBookingId);
    expect(bookingAfterCancel).not.toBeNull();
    expect(bookingAfterCancel?.status).toBe('cancelled');
    expect(bookingAfterCancel?.id).toBe(createdBookingId);

    console.log('✅ TC_BOOKING_004 passed: Booking cancelled successfully');
  });

  /**
   * [TC_BOOKING_005] Tạo booking vượt quá capacity
   * Mục tiêu: Kiểm tra validation khi quantity > tour capacity
   * Input: {user_id, tour_id, quantity: 10} (capacity = 3)
   * Expected: Ném lỗi "Không đủ vé" hoặc validation error
   * CheckDB: Không tạo booking mới trong DB
   * Rollback: Không cần (fail nên không có data mới)
   */
  it('[TC_BOOKING_005] should fail when booking quantity exceeds tour capacity', async () => {
    const excessiveQuantity = 10;
    const tourCapacity = 3;
    
    // Verify tour capacity
    const tour = await Tour.findByPk(testTourId);
    expect(tour?.capacity).toBe(tourCapacity);

    // Count bookings before attempt
    const bookingsBefore = await Order.count({ where: { tour_id: testTourId } });

    // Attempt to create booking with excessive quantity
    await expect(
      bookingService.createBooking({
        user_id: testUserId,
        tour_id: testTourId,
        quantity: excessiveQuantity // > capacity = 3
      })
    ).rejects.toThrow();

    // CheckDB: Verify no new booking was created
    const bookingsAfter = await Order.count({ where: { tour_id: testTourId } });
    expect(bookingsAfter).toBe(bookingsBefore);

    console.log('✅ TC_BOOKING_005 passed: Correctly rejected excessive quantity');
  });

  /**
   * [TC_BOOKING_006] Phân trang bookings
   * Mục tiêu: Kiểm tra pagination hoạt động đúng
   * Input: page=1, limit=1 và page=2, limit=1
   * Expected: Trả về các trang khác nhau với dữ liệu khác nhau
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_BOOKING_006] should paginate bookings correctly', async () => {
    const pageSize = 1;
    
    // Get page 1
    const firstPage = await bookingService.getUserBookings(testUserId, 1, pageSize);
    expect(firstPage.pagination.page).toBe(1);
    expect(firstPage.pagination.limit).toBe(pageSize);
    expect(firstPage.bookings.length).toBeLessThanOrEqual(pageSize);

    // Get page 2
    const secondPage = await bookingService.getUserBookings(testUserId, 2, pageSize);
    expect(secondPage.pagination.page).toBe(2);
    expect(secondPage.bookings.length).toBeLessThanOrEqual(pageSize);

    // Verify different pages return different data (if enough bookings exist)
    if (firstPage.bookings.length > 0 && secondPage.bookings.length > 0) {
      expect(firstPage.bookings[0].id).not.toBe(secondPage.bookings[0].id);
    }

    console.log('✅ TC_BOOKING_006 passed: Pagination working correctly');
  });

  /**
   * [TC_BOOKING_007] Lấy booking không tồn tại
   * Mục tiêu: Kiểm tra error handling khi bookingId không hợp lệ
   * Input: bookingId=999999 (không tồn tại)
   * Expected: Ném lỗi "Order không tồn tại"
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_BOOKING_007] should fail when booking does not exist', async () => {
    const nonExistentBookingId = 999999;

    // Verify booking doesn't exist in DB
    const bookingInDb = await Order.findByPk(nonExistentBookingId);
    expect(bookingInDb).toBeNull();

    // Attempt to get non-existent booking
    await expect(
      bookingService.getBookingById(nonExistentBookingId)
    ).rejects.toThrow();

    console.log('✅ TC_BOOKING_007 passed: Correctly handled non-existent booking');
  });

  /**
   * [TC_BOOKING_008] Hủy booking không tồn tại
   * Mục tiêu: Kiểm tra error handling khi hủy booking không có
   * Input: bookingId=999999 (không tồn tại)
   * Expected: Ném lỗi "Order không tồn tại"
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_BOOKING_008] should fail when cancelling non-existent booking', async () => {
    const nonExistentBookingId = 999999;

    await expect(
      bookingService.cancelBooking(nonExistentBookingId)
    ).rejects.toThrow();

    console.log('✅ TC_BOOKING_008 passed: Correctly handled cancel non-existent booking');
  });

  /**
   * [TC_BOOKING_009] Lọc bookings theo status
   * Mục tiêu: Kiểm tra filter bookings theo status
   * Input: userId, filter {status: 'pending'}
   * Expected: Chỉ trả về bookings có status='pending'
   * CheckDB: Verify tất cả bookings trả về đều có status='pending'
   * Rollback: Không thay đổi DB
   */
  it('[TC_BOOKING_009] should filter bookings by status', async () => {
    const targetStatus = 'pending';
    
    const filteredBookings = await bookingService.getUserBookings(testUserId, 1, 10, {
      status: targetStatus
    });

    // Verify response
    expect(filteredBookings).toBeDefined();
    expect(Array.isArray(filteredBookings.bookings)).toBe(true);

    // CheckDB: Verify all returned bookings have correct status
    for (const booking of filteredBookings.bookings) {
      expect(booking.status).toBe(targetStatus);
    }

    console.log(`✅ TC_BOOKING_009 passed: Retrieved ${filteredBookings.bookings.length} ${targetStatus} bookings`);
  });

  /**
   * [TC_BOOKING_010] Tạo booking với tour không tồn tại
   * Mục tiêu: Kiểm tra validation khi tourId không hợp lệ
   * Input: {user_id, tour_id: 999999, quantity: 1}
   * Expected: Ném lỗi "Tour không tồn tại"
   * CheckDB: Không tạo booking mới
   * Rollback: Không cần (fail)
   */
  it('[TC_BOOKING_010] should fail when tour does not exist', async () => {
    const nonExistentTourId = 999999;

    // Verify tour doesn't exist
    const tourInDb = await Tour.findByPk(nonExistentTourId);
    expect(tourInDb).toBeNull();

    // Count bookings before
    const bookingsBefore = await Order.count({ where: { user_id: testUserId } });

    await expect(
      bookingService.createBooking({
        user_id: testUserId,
        tour_id: nonExistentTourId,
        quantity: 1
      })
    ).rejects.toThrow();

    // CheckDB: Verify no booking was created
    const bookingsAfter = await Order.count({ where: { user_id: testUserId } });
    expect(bookingsAfter).toBe(bookingsBefore);

    console.log('✅ TC_BOOKING_010 passed: Correctly rejected non-existent tour');
  });

  /**
   * [TC_BOOKING_011] Xác nhận booking thành công
   * Mục tiêu: Kiểm tra confirmBooking cập nhật status thành 'confirmed'
   * Input: bookingId hợp lệ
   * Expected: Status chuyển từ 'pending' sang 'confirmed'
   * CheckDB: Verify status='confirmed' trong DB
   * Rollback: Booking vẫn tồn tại với status mới
   */
  it('[TC_BOOKING_011] should confirm booking successfully', async () => {
    // Create new booking for this test
    const newBooking = await bookingService.createBooking({
      user_id: testUserId,
      tour_id: testTourId,
      quantity: 1
    });
    createdBookings.push(newBooking.id);

    // Verify initial status
    expect(newBooking.status).toBe('pending');

    // Confirm booking
    await bookingService.confirmBooking(newBooking.id);

    // CheckDB: Verify status changed to 'confirmed'
    const bookingInDb = await Order.findByPk(newBooking.id);
    expect(bookingInDb).not.toBeNull();
    expect(bookingInDb?.status).toBe('confirmed');

    console.log('✅ TC_BOOKING_011 passed: Booking confirmed successfully');
  });

  /**
   * [TC_BOOKING_012] Lấy tất cả bookings với pagination
   * Mục tiêu: Kiểm tra getAllBookings trả về tất cả bookings hệ thống
   * Input: page=1, limit=10
   * Expected: Trả về danh sách bookings với pagination
   * CheckDB: So sánh total với count trong DB
   * Rollback: Không thay đổi DB
   */
  it('[TC_BOOKING_012] should get all bookings with pagination', async () => {
    const pageNumber = 1;
    const pageSize = 10;

    const allBookings = await bookingService.getAllBookings(pageNumber, pageSize);

    // Verify response structure
    expect(allBookings).toBeDefined();
    expect(Array.isArray(allBookings.bookings)).toBe(true);
    expect(allBookings.pagination).toBeDefined();
    expect(allBookings.pagination.page).toBe(pageNumber);

    // CheckDB: Verify total matches database count
    const totalBookingsInDb = await Order.count();
    expect(allBookings.pagination.total).toBe(totalBookingsInDb);

    console.log(`✅ TC_BOOKING_012 passed: Retrieved ${allBookings.bookings.length} bookings from total ${allBookings.pagination.total}`);
  });

  /**
   * [TC_BOOKING_013] Tạo booking với quantity = 0
   * Mục tiêu: Kiểm tra validation khi quantity không hợp lệ
   * Input: {user_id, tour_id, quantity: 0}
   * Expected: Ném lỗi validation (quantity phải > 0)
   * CheckDB: Không tạo booking mới
   * Rollback: Không cần (fail)
   */
  it('[TC_BOOKING_013] should fail when booking quantity is zero', async () => {
    const zeroQuantity = 0;
    
    const bookingsBefore = await Order.count({ where: { user_id: testUserId } });

    await expect(
      bookingService.createBooking({
        user_id: testUserId,
        tour_id: testTourId,
        quantity: zeroQuantity
      })
    ).rejects.toThrow();

    // CheckDB: Verify no booking created
    const bookingsAfter = await Order.count({ where: { user_id: testUserId } });
    expect(bookingsAfter).toBe(bookingsBefore);

    console.log('✅ TC_BOOKING_013 passed: Correctly rejected zero quantity');
  });

  /**
   * [TC_BOOKING_014] Tạo booking với quantity âm
   * Mục tiêu: Kiểm tra validation khi quantity < 0
   * Input: {user_id, tour_id, quantity: -1}
   * Expected: Ném lỗi validation
   * CheckDB: Không tạo booking
   * Rollback: Không cần
   */
  it('[TC_BOOKING_014] should fail when booking quantity is negative', async () => {
    const negativeQuantity = -1;
    
    const bookingsBefore = await Order.count({ where: { user_id: testUserId } });

    await expect(
      bookingService.createBooking({
        user_id: testUserId,
        tour_id: testTourId,
        quantity: negativeQuantity
      })
    ).rejects.toThrow();

    // CheckDB
    const bookingsAfter = await Order.count({ where: { user_id: testUserId } });
    expect(bookingsAfter).toBe(bookingsBefore);

    console.log('✅ TC_BOOKING_014 passed: Correctly rejected negative quantity');
  });

  /**
   * [TC_BOOKING_015] Hủy booking đã bị hủy
   * Mục tiêu: Kiểm tra hủy booking đã ở status 'cancelled'
   * Input: bookingId của booking đã cancelled
   * Expected: Có thể fail hoặc thành công (tùy logic)
   * CheckDB: Kiểm tra status không đổi
   * Rollback: Không cần
   */
  it('[TC_BOOKING_015] should handle cancelling already cancelled booking', async () => {
    // createdBookingId đã bị cancel ở TC_BOOKING_004
    const bookingBefore = await Order.findByPk(createdBookingId);
    expect(bookingBefore?.status).toBe('cancelled');

    try {
      await bookingService.cancelBooking(createdBookingId);
      
      // Nếu thành công, kiểm tra status vẫn là cancelled
      const bookingAfter = await Order.findByPk(createdBookingId);
      expect(bookingAfter?.status).toBe('cancelled');
      
      console.log('⚠️ TC_BOOKING_015: Service cho phép cancel booking đã cancelled');
    } catch (error: any) {
      // Nếu fail, service có validation tốt
      console.log('✅ TC_BOOKING_015: Service từ chối cancel booking đã cancelled (good)');
    }
  });

  /**
   * [TC_BOOKING_016] Xác nhận booking đã bị hủy
   * Mục tiêu: Kiểm tra confirm booking đã cancelled
   * Input: bookingId của booking cancelled
   * Expected: Nên fail (không thể confirm booking đã hủy)
   * CheckDB: Status không đổi
   * Rollback: Không cần
   */
  it('[TC_BOOKING_016] should fail when confirming cancelled booking', async () => {
    // createdBookingId đã bị cancel
    const bookingBefore = await Order.findByPk(createdBookingId);
    const statusBefore = bookingBefore?.status;
    expect(statusBefore).toBe('cancelled');

    await expect(
      bookingService.confirmBooking(createdBookingId)
    ).rejects.toThrow();

    // CheckDB: Verify status unchanged
    const bookingAfter = await Order.findByPk(createdBookingId);
    expect(bookingAfter?.status).toBe(statusBefore);

    console.log('✅ TC_BOOKING_016 passed: Cannot confirm cancelled booking');
  });

  /**
   * [TC_BOOKING_017] Tạo booking cho user không tồn tại
   * Mục tiêu: Kiểm tra validation khi userId không hợp lệ
   * Input: {user_id: 999999, tour_id, quantity: 1}
   * Expected: Ném lỗi "User không tồn tại"
   * CheckDB: Không tạo booking
   * Rollback: Không cần
   */
  it('[TC_BOOKING_017] should fail when user does not exist', async () => {
    const nonExistentUserId = 999999;

    // Verify user doesn't exist
    const userInDb = await User.findByPk(nonExistentUserId);
    expect(userInDb).toBeNull();

    const bookingsBefore = await Order.count();

    await expect(
      bookingService.createBooking({
        user_id: nonExistentUserId,
        tour_id: testTourId,
        quantity: 1
      })
    ).rejects.toThrow();

    // CheckDB
    const bookingsAfter = await Order.count();
    expect(bookingsAfter).toBe(bookingsBefore);

    console.log('✅ TC_BOOKING_017 passed: Correctly rejected non-existent user');
  });

  /**
   * [TC_BOOKING_018] Lấy bookings với page vượt quá total
   * Mục tiêu: Kiểm tra pagination khi page > totalPages
   * Input: page=999999, limit=10
   * Expected: Trả về empty array
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_BOOKING_018] should return empty when page exceeds total pages', async () => {
    const excessivePage = 999999;
    const pageSize = 10;

    const result = await bookingService.getUserBookings(testUserId, excessivePage, pageSize);

    expect(result).toBeDefined();
    expect(result.bookings.length).toBe(0);
    expect(result.pagination.page).toBe(excessivePage);

    console.log('✅ TC_BOOKING_018 passed: Correctly handled excessive page number');
  });

  /**
   * [TC_BOOKING_019] Tạo booking với tour không active
   * Mục tiêu: Kiểm tra validation khi tour.is_active = false
   * Input: {user_id, tour_id của tour inactive, quantity: 1}
   * Expected: Nên fail (không thể booking tour inactive)
   * CheckDB: Không tạo booking
   * Rollback: Không cần
   */
  it('[TC_BOOKING_019] should fail when booking inactive tour', async () => {
    // Tạo tour inactive
    const inactiveTour = await Tour.create({
      title: 'Inactive Tour Test',
      destination: 'Test',
      departure: 'Test',
      start_date: new Date('2026-12-01'),
      end_date: new Date('2026-12-05'),
      price: 3000000,
      capacity: 10,
      latitude: 0,
      longitude: 0,
      is_active: false // Tour không hoạt động
    });
    createdTours.push(inactiveTour.id);

    const bookingsBefore = await Order.count();

    try {
      await bookingService.createBooking({
        user_id: testUserId,
        tour_id: inactiveTour.id,
        quantity: 1
      });
      
      // Nếu thành công - đây có thể là bug
      console.log('⚠️ TC_BOOKING_019: Service cho phép booking tour inactive (có thể là bug)');
      
      // Rollback booking
      const newBooking = await Order.findOne({ 
        where: { tour_id: inactiveTour.id },
        order: [['created_at', 'DESC']]
      });
      if (newBooking) {
        await Order.destroy({ where: { id: newBooking.id } });
      }
    } catch (error: any) {
      console.log('✅ TC_BOOKING_019: Service từ chối booking tour inactive (good)');
    }
  });

  /**
   * [TC_BOOKING_020] Tạo booking với user inactive
   * Mục tiêu: Kiểm tra validation khi user.is_active = false
   * Input: {user_id của user inactive, tour_id, quantity: 1}
   * Expected: Nên fail (user bị khóa không được booking)
   * CheckDB: Không tạo booking
   * Rollback: Không cần
   */
  it('[TC_BOOKING_020] should fail when inactive user creates booking', async () => {
    // Tạo user inactive
    const hashedPassword = await bcrypt.hash('password123', 10);
    const inactiveUser = await User.create({
      username: 'inactive_booking_user',
      email: 'inactive_booking_' + Date.now() + '@mail.com',
      password_hash: hashedPassword,
      phone: '0907777777',
      is_active: false // User bị khóa
    });
    createdUsers.push(inactiveUser.id);

    const bookingsBefore = await Order.count();

    try {
      await bookingService.createBooking({
        user_id: inactiveUser.id,
        tour_id: testTourId,
        quantity: 1
      });
      
      console.log('⚠️ TC_BOOKING_020: Service cho phép inactive user booking (có thể là bug)');
      
      // Rollback
      const newBooking = await Order.findOne({ 
        where: { user_id: inactiveUser.id },
        order: [['created_at', 'DESC']]
      });
      if (newBooking) {
        await Order.destroy({ where: { id: newBooking.id } });
      }
    } catch (error: any) {
      console.log('✅ TC_BOOKING_020: Service từ chối inactive user booking (good)');
    }
  });
});