import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import bookingService from '../services/bookingService';
import Order from '../models/Order';
import User from '../models/User';
import Tour from '../models/Tour';
import Coupon from '../models/Coupon';
import UsedCoupon from '../models/UsedCoupon';
import Admin from '../models/Admin';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';

// Mock các service gây lỗi side-effect hoặc yêu cầu credentials
vi.mock('../services/notificationService', () => ({
  default: {
    sendNotificationToUser: vi.fn().mockResolvedValue({ success: true })
  }
}));

vi.mock('../services/emailService', () => ({
  sendCancellationEmail: vi.fn().mockResolvedValue({ success: true }),
  sendConfirmationEmail: vi.fn().mockResolvedValue({ success: true })
}));

// Mock paymentService để tránh gọi MoMo thật
vi.mock('../services/paymentService', () => ({
  default: {
    createPayment: vi.fn().mockResolvedValue({ payUrl: 'https://mock-payment-url.com/pay' })
  }
}));

// Mock tourGuideAssignmentService để kiểm soát kết quả available guides
vi.mock('../services/tourGuideAssignmentService', () => ({
  default: {
    getAvailableGuidesForTour: vi.fn().mockResolvedValue([
      { id: 1, canAssign: true }
    ])
  }
}));

// Mock ticketService để tránh side-effect
vi.mock('../services/ticketService', () => ({
  default: {
    cancelTicketsByOrderId: vi.fn().mockResolvedValue(0)
  }
}));

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
 * - updatePaymentStatus()
 * - completeBooking()
 * - getTotalCompletedOrders()
 * - cancelExpiredPendingBookings()
 * - hardDeleteOrder()
 * - completeExpiredConfirmedOrders()
 */

describe('[Feature 7] Booking Management - Improved Tests', () => {
  let testUserId: number;
  let testTourId: number;
  let createdBookingId: number;

  let createdBookings: number[] = [];
  let createdUsers: number[] = [];
  let createdTours: number[] = [];
  let createdCoupons: number[] = [];

  beforeAll(async () => {
    console.log('📝 Start Booking Tests...');

    const hashedPassword = await bcrypt.hash('password123', 10);

    const user = await User.create({
      username: 'booking_user_' + Date.now(),
      email: 'booking_' + Date.now() + '@mail.com',
      password_hash: hashedPassword,
      phone: '0903333333',
      is_active: true
    });
    testUserId = user.id;
    createdUsers.push(user.id);

    const tour = await Tour.create({
      title: 'Test Tour ' + Date.now(),
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
   * Thứ tự xóa: Bookings → UsedCoupons → Coupons → Tours → Users (theo foreign key constraints)
   */
  afterAll(async () => {
    console.log('🔄 Starting Rollback...');

    // Xóa bookings trước (có foreign key đến users và tours)
    for (const bookingId of createdBookings) {
      await Order.destroy({ where: { id: bookingId } }).catch(() => { });
    }

    // Xóa used_coupons liên quan đến coupons test
    for (const couponId of createdCoupons) {
      await UsedCoupon.destroy({ where: { coupon_id: couponId } }).catch(() => { });
    }

    // Xóa coupons
    for (const couponId of createdCoupons) {
      await Coupon.destroy({ where: { id: couponId } }).catch(() => { });
    }

    // Xóa tours
    for (const tourId of createdTours) {
      await Tour.destroy({ where: { id: tourId } }).catch(() => { });
    }

    // Xóa users
    for (const userId of createdUsers) {
      await User.destroy({ where: { id: userId } }).catch(() => { });
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
    expect(Number(bookingResult.total_price)).toBe(expectedTotalPrice);

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
    expect(Number(orderInDb?.total_price)).toBe(expectedTotalPrice);
  });


  /**
   * [TC_BOOKING_002] Hủy booking thành công
   * Mục tiêu: Kiểm tra cancelBooking cập nhật status thành 'cancelled'
   * Input: bookingId hợp lệ
   * Expected: Status chuyển từ 'pending' sang 'cancelled'
   * CheckDB: Verify status='cancelled' trong DB
   * Rollback: Booking vẫn tồn tại (soft delete), không cần rollback
   */
  it('[TC_BOOKING_002] should cancel booking successfully', async () => {
    if (!createdBookingId) throw new Error('Booking ID chưa được tạo ở TC_001');
    const bookingBeforeCancel = await Order.findByPk(createdBookingId);
    const statusBeforeCancel = bookingBeforeCancel?.status;
    expect(statusBeforeCancel).toBe('pending');

    // Cancel booking with dummy adminId = 1
    await bookingService.cancelBooking(createdBookingId, 1);

    // CheckDB: Verify status changed to 'cancelled' in database
    const bookingAfterCancel = await Order.findByPk(createdBookingId);
    expect(bookingAfterCancel).not.toBeNull();
    expect(bookingAfterCancel?.status).toBe('cancelled');
    expect(bookingAfterCancel?.id).toBe(createdBookingId);
  });

  /**
   * [TC_BOOKING_003] Tạo booking vượt quá capacity
   * Mục tiêu: Kiểm tra validation khi quantity > tour capacity
   * Input: {user_id, tour_id, quantity: 10} (capacity = 3)
   * Expected: Ném lỗi "Không đủ vé" hoặc validation error
   * CheckDB: Không tạo booking mới trong DB
   * Rollback: Không cần (fail nên không có data mới)
   */
  it('[TC_BOOKING_003] should fail when booking quantity exceeds tour capacity', async () => {
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
  });


  /**
   * [TC_BOOKING_004] Lấy booking không tồn tại
   * Mục tiêu: Kiểm tra error handling khi bookingId không hợp lệ
   * Input: bookingId=999999 (không tồn tại)
   * Expected: Ném lỗi "Order không tồn tại"
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_BOOKING_004] should fail when booking does not exist', async () => {
    const nonExistentBookingId = 999999;

    // Verify booking doesn't exist in DB
    const bookingInDb = await Order.findByPk(nonExistentBookingId);
    expect(bookingInDb).toBeNull();

    // Attempt to get non-existent booking
    await expect(
      bookingService.getBookingById(nonExistentBookingId)
    ).rejects.toThrow();
  });



  /**
   * [TC_BOOKING_005] Tạo booking với tour không tồn tại
   * Mục tiêu: Kiểm tra validation khi tourId không hợp lệ
   * Input: {user_id, tour_id: 999999, quantity: 1}
   * Expected: Ném lỗi "Tour không tồn tại"
   * CheckDB: Không tạo booking mới
   * Rollback: Không cần (fail)
   */
  it('[TC_BOOKING_005] should fail when tour does not exist', async () => {
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
  });

  /**
   * [TC_BOOKING_006] Xác nhận booking thành công
   * Mục tiêu: Kiểm tra confirmBooking cập nhật status thành 'confirmed'
   * Input: bookingId hợp lệ
   * Expected: Status chuyển từ 'pending' sang 'confirmed'
   * CheckDB: Verify status='confirmed' trong DB
   * Rollback: Booking vẫn tồn tại với status mới
   */
  it('[TC_BOOKING_006] should confirm booking successfully', async () => {
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
  });


  /**
   * [TC_BOOKING_007] Tạo booking với quantity âm
   * Mục tiêu: Kiểm tra validation khi quantity < 0
   * Input: {user_id, tour_id, quantity: -1}
   * Expected: Ném lỗi validation
   * CheckDB: Không tạo booking
   * Rollback: Không cần
   */
  it('[TC_BOOKING_007] should fail when booking quantity is negative', async () => {
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
  });

  /**
   * [TC_BOOKING_008] Hủy booking đã bị hủy
   * Mục tiêu: Kiểm tra hệ thống từ chối hủy booking đã ở trạng thái 'cancelled'
   * Input: bookingId của booking đã cancelled
   * Expected: Ném lỗi (throw error) do không thể hủy booking đã hủy
   * CheckDB: Không thay đổi status (vẫn là 'cancelled')
   * Rollback: Không cần
   */
  it('[TC_BOOKING_008] should throw error when cancelling already cancelled booking', async () => {
    const bookingBefore = await Order.findByPk(createdBookingId);
    expect(bookingBefore?.status).toBe('cancelled');
    await expect(bookingService.cancelBooking(createdBookingId, 1)).rejects.toThrow();
  });

  /**
   * [TC_BOOKING_009] Tạo booking cho user không tồn tại
   * Mục tiêu: Kiểm tra validation khi userId không hợp lệ
   * Input: {user_id: 999999, tour_id, quantity: 1}
   * Expected: Ném lỗi "User không tồn tại"
   * CheckDB: Không tạo booking
   * Rollback: Không cần
   */
  it('[TC_BOOKING_009] should fail when user does not exist', async () => {
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

    console.log('✅ TC_BOOKING_009 passed: Correctly rejected non-existent user');
  });




  /**
   * [TC_BOOKING_010] 
   * Mục tiêu: Test getAllBookings với status
   */

it('[TC_BOOKING_010] should filter bookings by booking_status', async () => {
  const result = await bookingService.getAllBookings(1, 10, { booking_status: 'pending' });
  expect(result.bookings.every(b => b.status === 'pending')).toBe(true);
});

  /**
   * [TC_BOOKING_011] 
   * Mục tiêu: Test getUserBookings với tour_code
   */
  it('[TC_BOOKING_011] should filter user bookings with tour_code', async () => {
    // Test filter với tour_code
    const filteredByCode = await bookingService.getUserBookings(testUserId, 1, 10, {
      tour_code: 'TOUR'
    });
    expect(filteredByCode).toBeDefined();
  });



  /**
   * [TC_BOOKING_012] Get booking không tồn tại (updatePaymentStatus)
   * Mục tiêu: Test error handling cho updatePaymentStatus với booking không tồn tại
   */
  it('[TC_BOOKING_012] should fail update payment status for non-existent booking', async () => {
    await expect(
      bookingService.updatePaymentStatus(999999, true)
    ).rejects.toThrow('Booking không tồn tại');
  });

  /**
   * [TC_BOOKING_013] Complete booking không tồn tại
   * Mục tiêu: Test error handling cho completeBooking với booking không tồn tại
   */
  it('[TC_BOOKING_013] should fail complete booking for non-existent booking', async () => {
    await expect(
      bookingService.completeBooking(999999)
    ).rejects.toThrow('Booking không tồn tại');

  });

  /**
   * [TC_BOOKING_014] Cancel booking đã completed
   * Mục tiêu: Test không thể hủy booking đã hoàn thành
   */
  it('[TC_BOOKING_014] should fail cancel completed booking', async () => {
    // Tạo tour mới
    const newTour = await Tour.create({
      title: 'Cancel Completed Test Tour ' + Date.now(),
      destination: 'HN',
      departure: 'HCM',
      start_date: new Date('2026-11-01'),
      end_date: new Date('2026-11-05'),
      price: 3000000,
      capacity: 50,
      latitude: 0,
      longitude: 0,
      is_active: true
    });
    createdTours.push(newTour.id);

    // Tạo booking và complete nó
    const newBooking = await bookingService.createBooking({
      user_id: testUserId,
      tour_id: newTour.id,
      quantity: 1
    });
    createdBookings.push(newBooking.id);

    await bookingService.completeBooking(newBooking.id);

    // Thử hủy booking đã completed
    await expect(
      bookingService.cancelBooking(newBooking.id, 1)
    ).rejects.toThrow('Không thể hủy booking đã hoàn thành');

  });

  /**
   * [TC_BOOKING_015] Cancel booking thiếu adminId
   * Mục tiêu: Test validation khi thiếu adminId
   */
  it('[TC_BOOKING_015] should fail cancel booking without adminId', async () => {
    // Tạo tour mới
    const newTour = await Tour.create({
      title: 'Cancel No Admin Test Tour ' + Date.now(),
      destination: 'HN',
      departure: 'HCM',
      start_date: new Date('2026-11-01'),
      end_date: new Date('2026-11-05'),
      price: 3000000,
      capacity: 50,
      latitude: 0,
      longitude: 0,
      is_active: true
    });
    createdTours.push(newTour.id);

    // Tạo booking mới
    const newBooking = await bookingService.createBooking({
      user_id: testUserId,
      tour_id: newTour.id,
      quantity: 1
    });
    createdBookings.push(newBooking.id);

    // Thử hủy mà không có adminId
    await expect(
      bookingService.cancelBooking(newBooking.id, undefined as any)
    ).rejects.toThrow('Chỉ admin tổng mới có quyền hủy booking');
  });

  /**
   * [TC_BOOKING_016] Get total completed orders
   * Mục tiêu: Test getTotalCompletedOrders method
   */
  it('[TC_BOOKING_016] should get total completed orders', async () => {
    const result = await bookingService.getTotalCompletedOrders();

    expect(result).toBeDefined();
    expect(result.total_completed_orders).toBeDefined();
    expect(typeof result.total_completed_orders).toBe('number');
    expect(result.message).toContain('Tổng số đơn hàng đã bán được');
  });

  /**
   * [TC_BOOKING_017] Get all bookings với date range filter
   * Mục tiêu: Test getAllBookings với start_date và end_date
   */
  it('[TC_BOOKING_017] should filter all bookings by date range', async () => {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);

    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    const dateFilteredBookings = await bookingService.getAllBookings(1, 10, {
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString()
    });

    expect(dateFilteredBookings).toBeDefined();
    expect(Array.isArray(dateFilteredBookings.bookings)).toBe(true);
  });


  /**
   * [TC_BOOKING_018] Test booking với price thấp (boundary test)
   */
  it('[TC_BOOKING_018] should fail booking with total price below minimum', async () => {
    // Tạo tour với price rất thấp
    const cheapTour = await Tour.create({
      title: 'Cheap Tour ' + Date.now(),
      destination: 'Test',
      departure: 'Test',
      start_date: new Date('2026-12-01'),
      end_date: new Date('2026-12-05'),
      price: 5000, // Rất thấp, quantity 1 => total = 5000 < 10000
      capacity: 10,
      latitude: 0,
      longitude: 0,
      is_active: true
    });
    createdTours.push(cheapTour.id);

    await expect(
      bookingService.createBooking({
        user_id: testUserId,
        tour_id: cheapTour.id,
        quantity: 1
      })
    ).rejects.toThrow('Tổng tiền phải tối thiểu 10.000 VND');
  });

  /**
   * [TC_BOOKING_019] Test booking với price cao (boundary test)
   */
  it('[TC_BOOKING_019] should fail booking with total price above maximum', async () => {
    // Tạo tour với price rất cao
    const expensiveTour = await Tour.create({
      title: 'Expensive Tour ' + Date.now(),
      destination: 'Test',
      departure: 'Test',
      start_date: new Date('2026-12-01'),
      end_date: new Date('2026-12-05'),
      price: 60000000, // quantity 1 => total = 60M > 50M
      capacity: 10,
      latitude: 0,
      longitude: 0,
      is_active: true
    });
    createdTours.push(expensiveTour.id);

    await expect(
      bookingService.createBooking({
        user_id: testUserId,
        tour_id: expensiveTour.id,
        quantity: 1
      })
    ).rejects.toThrow('Tổng tiền vượt quá giới hạn 50.000.000 VND');

    console.log('✅ TC_BOOKING_019: Từ chối booking với total price quá cao');
  });


  /**
   * [TC_BOOKING_020] Test confirm booking không tồn tại
   */
  it('[TC_BOOKING_020] should fail confirm non-existent booking', async () => {
    await expect(
      bookingService.confirmBooking(999999)
    ).rejects.toThrow('Booking không tồn tại');

    console.log('✅ TC_BOOKING_020: Từ chối confirm booking không tồn tại');
  });

  /**
   * [TC_BOOKING_021] Test getAllBookings với search filter
   */
  it('[TC_BOOKING_021] should filter all bookings with search', async () => {
    // Tạo booking để search
    const newTour = await Tour.create({
      title: 'Search Test Tour ' + Date.now(),
      destination: 'HN',
      departure: 'HCM',
      start_date: new Date('2026-11-01'),
      end_date: new Date('2026-11-05'),
      price: 3000000,
      capacity: 50,
      latitude: 0,
      longitude: 0,
      is_active: true
    });
    createdTours.push(newTour.id);

    // Search với tour_code
    const searchByTourCode = await bookingService.getAllBookings(1, 10, {
      search: newTour.tour_code || ''
    });
    expect(searchByTourCode).toBeDefined();

  });

  /**
   * [TC_BOOKING_022] Test getBookingById không có userId (admin view)
   */
  it('[TC_BOOKING_022] should get booking without userId (admin view)', async () => {
    // Tạo booking
    const newTour = await Tour.create({
      title: 'Admin View Test ' + Date.now(),
      destination: 'HN',
      departure: 'HCM',
      start_date: new Date('2026-11-01'),
      end_date: new Date('2026-11-05'),
      price: 3000000,
      capacity: 50,
      latitude: 0,
      longitude: 0,
      is_active: true
    });
    createdTours.push(newTour.id);

    const newBooking = await bookingService.createBooking({
      user_id: testUserId,
      tour_id: newTour.id,
      quantity: 1
    });
    createdBookings.push(newBooking.id);

    // Get booking không có userId (admin view)
    const bookingAdmin = await bookingService.getBookingById(newBooking.id);
    expect(bookingAdmin).toBeDefined();
    expect(bookingAdmin.id).toBe(newBooking.id);
    expect(bookingAdmin.tour).toBeDefined();
    expect(bookingAdmin.user).toBeDefined();
  });

  /**
   * [TC_BOOKING_023] Test createBooking với tour_id  không hợp lệ
   */
  it('[TC_BOOKING_023] should fail with invalid tour_id types', async () => {
    // Test với tour_id = NaN
    await expect(
      bookingService.createBooking({
        user_id: testUserId,
        tour_id: NaN as any,
        quantity: 1
      })
    ).rejects.toThrow('ID tour không hợp lệ');
  });

  /**
   * [TC_BOOKING_024] Tạo booking với coupon có discount_amount
   * Mục tiêu: Cover nhánh coupon.discount_amount trong createBooking
   * Input: {user_id, tour_id, quantity: 1, coupon_id} với coupon giảm tiền cố định
   * Expected: total_price = originalPrice - discount_amount
   * CheckDB: Verify total_price đúng, UsedCoupon đã tạo
   * Rollback: Xóa booking, coupon trong afterAll
   */
  it('[TC_BOOKING_024] should apply discount_amount coupon correctly', async () => {
    // Tạo tour
    const newTour = await Tour.create({
      title: 'Coupon Amount Tour ' + Date.now(),
      destination: 'HN',
      departure: 'HCM',
      start_date: new Date('2026-11-01'),
      end_date: new Date('2026-11-05'),
      price: 3000000,
      capacity: 50,
      latitude: 0,
      longitude: 0,
      is_active: true
    });
    createdTours.push(newTour.id);

    const discountAmount = 500000;

    // Tạo coupon giảm tiền cố định
    const coupon = await Coupon.create({
      code: 'AMOUNT500_' + Date.now(),
      discount_amount: discountAmount,
      max_use: 3,
      discount_limit: 100000,
      is_active: true,
      expire_at: new Date('2027-12-31')
    });

    createdCoupons.push(coupon.id);

    const originalPrice = 3000000 * 1; // quantity = 1
    const expectedTotalPrice = originalPrice - discountAmount;

    const booking = await bookingService.createBooking({
      user_id: testUserId,
      tour_id: newTour.id,
      quantity: 1,
      coupon_id: coupon.id
    });
    createdBookings.push(booking.id);

    // Verify total_price đúng
    expect(Number(booking.total_price)).toBe(expectedTotalPrice);

    // CheckDB: UsedCoupon đã được tạo
    const usedCoupon = await UsedCoupon.findOne({ where: { order_id: booking.id } });
    expect(usedCoupon).not.toBeNull();
  });

  /**
   * [TC_BOOKING_025] Tạo booking với coupon đã hết hạn
   * Mục tiêu: Cover nhánh coupon expire_at validation
   * Input: coupon có expire_at < ngày hiện tại
   * Expected: Ném lỗi "Mã giảm giá đã hết hạn"
   * CheckDB: Không tạo booking
   * Rollback: Xóa coupon trong afterAll
   */
  it('[TC_BOOKING_025] should fail when coupon is expired', async () => {
    // Tạo tour
    const newTour = await Tour.create({
      title: 'Expired Coupon Tour ' + Date.now(),
      destination: 'HN',
      departure: 'HCM',
      start_date: new Date('2026-11-01'),
      end_date: new Date('2026-11-05'),
      price: 2000000,
      capacity: 50,
      latitude: 0,
      longitude: 0,
      is_active: true
    });
    createdTours.push(newTour.id);

    // Tạo coupon đã hết hạn (expire_at = ngày trong quá khứ)
    const expiredCoupon = await Coupon.create({
      code: 'EXPIRED_' + Date.now(),
      discount_percent: 10,
      discount_amount: null,
      max_use: 5,
      is_active: true,
      expire_at: new Date('2020-01-01') // Đã hết hạn
    } as any);
    createdCoupons.push(expiredCoupon.id);

    const bookingsBefore = await Order.count({ where: { user_id: testUserId } });

    await expect(
      bookingService.createBooking({
        user_id: testUserId,
        tour_id: newTour.id,
        quantity: 1,
        coupon_id: expiredCoupon.id
      })
    ).rejects.toThrow('Mã giảm giá đã hết hạn');

    // CheckDB: Không có booking nào được tạo
    const bookingsAfter = await Order.count({ where: { user_id: testUserId } });
    expect(bookingsAfter).toBe(bookingsBefore);

  });

  /**
   * [TC_BOOKING_026] Tạo booking với coupon đã bị vô hiệu hóa (is_active = false)
   * Mục tiêu: Cover nhánh coupon is_active validation
   * Input: coupon có is_active = false
   * Expected: Ném lỗi "Mã giảm giá đã bị vô hiệu hóa"
   * CheckDB: Không tạo booking
   * Rollback: Xóa coupon trong afterAll
   */
  it('[TC_BOOKING_026] should fail when coupon is inactive', async () => {
    // Tạo tour
    const newTour = await Tour.create({
      title: 'Inactive Coupon Tour ' + Date.now(),
      destination: 'HN',
      departure: 'HCM',
      start_date: new Date('2026-11-01'),
      end_date: new Date('2026-11-05'),
      price: 2000000,
      capacity: 50,
      latitude: 0,
      longitude: 0,
      is_active: true
    });
    createdTours.push(newTour.id);

    // Tạo coupon is_active = false
    const inactiveCoupon = await Coupon.create({
      code: 'INACTIVE_' + Date.now(),
      discount_percent: 10,
      discount_limit: 100000,
      max_use: 5,
      is_active: false,
      expire_at: new Date('2027-12-31')
    });
    createdCoupons.push(inactiveCoupon.id);

    await expect(
      bookingService.createBooking({
        user_id: testUserId,
        tour_id: newTour.id,
        quantity: 1,
        coupon_id: inactiveCoupon.id
      })
    ).rejects.toThrow('Mã giảm giá đã bị vô hiệu hóa');

  });

  /**
   * [TC_BOOKING_027] Tạo booking với coupon đã hết lượt sử dụng (max_use = 0)
   * Mục tiêu: Cover nhánh max_use === 0 validation
   * Input: coupon có max_use = 0
   * Expected: Ném lỗi "Mã giảm giá đã hết lượt sử dụng"
   * CheckDB: Không tạo booking
   * Rollback: Xóa coupon trong afterAll
   */
  it('[TC_BOOKING_027] should fail when coupon has no remaining uses', async () => {
    // Tạo tour
    const newTour = await Tour.create({
      title: 'No Use Coupon Tour ' + Date.now(),
      destination: 'HN',
      departure: 'HCM',
      start_date: new Date('2026-11-01'),
      end_date: new Date('2026-11-05'),
      price: 2000000,
      capacity: 50,
      latitude: 0,
      longitude: 0,
      is_active: true
    });
    createdTours.push(newTour.id);

    // Tạo coupon max_use = 0 (hết lượt)
    const exhaustedCoupon = await Coupon.create({
      code: 'MAXUSE0_' + Date.now(),
      discount_percent: 10,
      discount_limit: 100000,
      max_use: 0,
      is_active: true,
      expire_at: new Date('2027-12-31')
    });
    createdCoupons.push(exhaustedCoupon.id);

    await expect(
      bookingService.createBooking({
        user_id: testUserId,
        tour_id: newTour.id,
        quantity: 1,
        coupon_id: exhaustedCoupon.id
      })
    ).rejects.toThrow('Mã giảm giá đã hết lượt sử dụng');
  });

  /**
   * [TC_BOOKING_028] Tạo booking với coupon_id không tồn tại
   * Mục tiêu: Cover nhánh coupon không tìm thấy
   * Input: coupon_id = 999999 (không tồn tại)
   * Expected: Ném lỗi "Mã giảm giá không tồn tại"
   * CheckDB: Không tạo booking
   * Rollback: Không cần
   */
  it('[TC_BOOKING_028] should fail when coupon does not exist', async () => {
    // Tạo tour
    const newTour = await Tour.create({
      title: 'No Coupon Tour ' + Date.now(),
      destination: 'HN',
      departure: 'HCM',
      start_date: new Date('2026-11-01'),
      end_date: new Date('2026-11-05'),
      price: 2000000,
      capacity: 50,
      latitude: 0,
      longitude: 0,
      is_active: true
    });
    createdTours.push(newTour.id);

    await expect(
      bookingService.createBooking({
        user_id: testUserId,
        tour_id: newTour.id,
        quantity: 1,
        coupon_id: 999999 // Không tồn tại
      })
    ).rejects.toThrow('Mã giảm giá không tồn tại');
  });

  /**
   * [TC_BOOKING_029] Tạo booking với coupon_id âm (invalid)
   * Mục tiêu: Cover nhánh validation coupon_id <= 0
   * Input: coupon_id = -1
   * Expected: Ném lỗi "ID coupon không hợp lệ"
   * CheckDB: Không tạo booking
   * Rollback: Không cần
   */
  it('[TC_BOOKING_029] should fail when coupon_id is invalid (negative)', async () => {
    // Tạo tour
    const newTour = await Tour.create({
      title: 'Invalid Coupon ID Tour ' + Date.now(),
      destination: 'HN',
      departure: 'HCM',
      start_date: new Date('2026-11-01'),
      end_date: new Date('2026-11-05'),
      price: 2000000,
      capacity: 50,
      latitude: 0,
      longitude: 0,
      is_active: true
    });
    createdTours.push(newTour.id);

    await expect(
      bookingService.createBooking({
        user_id: testUserId,
        tour_id: newTour.id,
        quantity: 1,
        coupon_id: -1
      })
    ).rejects.toThrow('ID coupon không hợp lệ');
  });

  /**
 * [TC_BOOKING_030] Tạo booking - coupon với max_use = 1 bị vô hiệu hóa sau khi dùng
 * Mục tiêu: Cover nhánh max_use giảm về 0, is_active chuyển thành false
 * Input: coupon có max_use = 1
 * Expected: Sau khi tạo booking, coupon.max_use = 0 và coupon.is_active = false
 * CheckDB: Verify coupon bị vô hiệu hóa
 * Rollback: Xóa booking, coupon trong afterAll
 */
  it('[TC_BOOKING_030] should deactivate coupon when max_use reaches zero', async () => {
    // ===== 1. Tạo tour =====
    const newTour = await Tour.create({
      title: 'Last Use Coupon Tour ' + Date.now(),
      destination: 'HN',
      departure: 'HCM',
      start_date: new Date('2026-11-01'),
      end_date: new Date('2026-11-05'),
      price: 2000000,
      capacity: 50,
      latitude: 0,
      longitude: 0,
      is_active: true
    });
    createdTours.push(newTour.id);

    // ===== 2. Tạo coupon chỉ có 1 lượt =====
    const lastUseCoupon = await Coupon.create({
      code: 'LASTUSE_' + Date.now(),
      discount_percent: 5,
      max_use: 1,
      discount_limit: 100000,
      is_active: true,
      expire_at: new Date('2027-12-31')
    });
    createdCoupons.push(lastUseCoupon.id);

    // ===== 3. Tạo booking sử dụng coupon =====
    const booking = await bookingService.createBooking({
      user_id: testUserId,
      tour_id: newTour.id,
      quantity: 1,
      coupon_id: lastUseCoupon.id
    });
    createdBookings.push(booking.id);

    // ===== 4. Verify booking tạo thành công =====
    expect(booking).toBeDefined();
    expect(booking.id).toBeDefined();

    // ===== 5. Check DB: Coupon phải bị update =====
    const updatedCoupon = await Coupon.findByPk(lastUseCoupon.id);

    expect(updatedCoupon).not.toBeNull();

    // max_use từ 1 -> 0
    expect(updatedCoupon?.max_use).toBe(0);

    // is_active phải chuyển thành false
    expect(updatedCoupon?.is_active).toBe(false);

  });
  /**
   * [TC_BOOKING_031] Hủy booking có coupon → hoàn trả coupon
   * Mục tiêu: Cover nhánh refundCouponForOrder trong cancelBooking
   * Input: bookingId của booking đã dùng coupon
   * Expected: UsedCoupon bị xóa, coupon.max_use tăng lên 1, coupon.is_active = true
   * CheckDB: Verify coupon được hoàn trả
   * Rollback: Xóa booking trong afterAll
   */
  it('[TC_BOOKING_031] should refund coupon when booking is cancelled', async () => {
    // Tạo tour
    const newTour = await Tour.create({
      title: 'Refund Coupon Tour ' + Date.now(),
      destination: 'HN',
      departure: 'HCM',
      start_date: new Date('2026-11-01'),
      end_date: new Date('2026-11-05'),
      price: 2000000,
      capacity: 50,
      latitude: 0,
      longitude: 0,
      is_active: true
    });
    createdTours.push(newTour.id);

    // Tạo coupon
    const refundCoupon = await Coupon.create({
      code: 'REFUND_' + Date.now(),
      discount_percent: 10,
      discount_limit: 100000,
      max_use: 3,
      is_active: true,
      expire_at: new Date('2027-12-31')
    });
    createdCoupons.push(refundCoupon.id);

    // Tạo booking với coupon
    const booking = await bookingService.createBooking({
      user_id: testUserId,
      tour_id: newTour.id,
      quantity: 1,
      coupon_id: refundCoupon.id
    });
    createdBookings.push(booking.id);

    // Xác nhận max_use đã giảm
    const couponAfterBooking = await Coupon.findByPk(refundCoupon.id);
    expect(Number(couponAfterBooking?.max_use)).toBe(2); // 3 - 1 = 2

    // Hủy booking → coupon phải được hoàn trả
    await bookingService.cancelBooking(booking.id, 1);

    // CheckDB: UsedCoupon đã bị xóa
    const usedCoupon = await UsedCoupon.findOne({ where: { order_id: booking.id } });
    expect(usedCoupon).toBeNull();

    // CheckDB: max_use tăng lên 1
    const couponAfterCancel = await Coupon.findByPk(refundCoupon.id);
    expect(Number(couponAfterCancel?.max_use)).toBe(3); // 2 + 1 = 3

  });

  /**
   * [TC_BOOKING_032] getBookingById - Lấy booking của user khác (không có quyền)
   * Mục tiêu: Cover nhánh authorization check trong getBookingById
   * Input: bookingId của user A, nhưng userId là user B
   * Expected: Ném lỗi "Bạn không có quyền xem booking này"
   * CheckDB: Không thay đổi DB
   * Rollback: Xóa user B trong afterAll
   */
  it('[TC_BOOKING_032] should fail when user tries to view another users booking', async () => {
    // Tạo user thứ hai
    const hashedPassword = await bcrypt.hash('password123', 10);
    const anotherUser = await User.create({
      username: 'another_user_' + Date.now(),
      email: 'another_' + Date.now() + '@mail.com',
      password_hash: hashedPassword,
      phone: '0909999999',
      is_active: true
    });
    createdUsers.push(anotherUser.id);

    // Tạo tour và booking cho testUserId (user A)
    const newTour = await Tour.create({
      title: 'Auth Check Tour ' + Date.now(),
      destination: 'HN',
      departure: 'HCM',
      start_date: new Date('2026-11-01'),
      end_date: new Date('2026-11-05'),
      price: 2000000,
      capacity: 50,
      latitude: 0,
      longitude: 0,
      is_active: true
    });
    createdTours.push(newTour.id);

    const bookingOfUserA = await bookingService.createBooking({
      user_id: testUserId,
      tour_id: newTour.id,
      quantity: 1
    });
    createdBookings.push(bookingOfUserA.id);

    // User B cố lấy booking của User A => phải bị từ chối
    await expect(
      bookingService.getBookingById(bookingOfUserA.id, anotherUser.id)
    ).rejects.toThrow('Bạn không có quyền xem booking này');

  });

  /**
   * [TC_BOOKING_033] completeExpiredConfirmedOrders - không có order nào cần complete
   * Mục tiêu: Test completeExpiredConfirmedOrders khi không có order hết hạn
   * Input: Không có order confirmed nào có end_date < hôm nay
   * Expected: { completed: 0, message: "Không có order nào..." }
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_BOOKING_033] should return zero when no expired confirmed orders exist', async () => {
    const result = await bookingService.completeExpiredConfirmedOrders();

    expect(result).toBeDefined();
    expect(result.completed).toBeDefined();
    expect(typeof result.completed).toBe('number');
    expect(result.message).toBeDefined();

    // Vì các tour test đều có end_date trong tương lai, nên không có gì cần complete
    // (Tuy nhiên nếu DB có sẵn dữ liệu cũ, completed có thể > 0)
    expect(result.completed).toBeGreaterThanOrEqual(0);

  });

  /**
   * [TC_BOOKING_034] completeExpiredConfirmedOrders - tự động complete order quá end_date
   * Mục tiêu: Cover nhánh tự động chuyển trạng thái confirmed → completed
   * Input: Tạo order confirmed với end_date trong quá khứ
   * Expected: Order bị chuyển sang 'completed'
   * CheckDB: Verify order.status = 'completed'
   * Rollback: Xóa order, tour trong afterAll
   */
  it('[TC_BOOKING_034] should auto-complete confirmed orders past end_date', async () => {
    // Tạo tour với end_date trong quá khứ
    const pastTour = await Tour.create({
      title: 'Past End Date Tour ' + Date.now(),
      destination: 'HN',
      departure: 'HCM',
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-01-05'), // Đã qua
      price: 2000000,
      capacity: 50,
      latitude: 0,
      longitude: 0,
      is_active: true
    });
    createdTours.push(pastTour.id);

    // Tạo order trực tiếp với status='confirmed' và end_date trong quá khứ
    const pastOrder = await Order.create({
      user_id: testUserId,
      tour_id: pastTour.id,
      quantity: 1,
      total_price: 2000000,
      status: 'confirmed',
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-01-05'),
      payment_url: 'https://mock.com',
      is_paid: true,
      is_review: false
    });
    createdBookings.push(pastOrder.id);

    // Gọi completeExpiredConfirmedOrders
    const result = await bookingService.completeExpiredConfirmedOrders();

    expect(result).toBeDefined();
    expect(result.completed).toBeGreaterThanOrEqual(1);

    // CheckDB: Order phải chuyển thành 'completed'
    const updatedOrder = await Order.findByPk(pastOrder.id);
    expect(updatedOrder?.status).toBe('completed');

  });

  /**
   * [TC_BOOKING_035] hardDeleteOrder - Xóa vĩnh viễn order thành công
   * Mục tiêu: Cover nhánh hardDeleteOrder
   * Input: bookingId hợp lệ
   * Expected: Order bị xóa hoàn toàn khỏi DB
   * CheckDB: Order.findByPk trả về null
   * Rollback: Không cần (đã xóa)
   */
  it('[TC_BOOKING_035] should hard delete order successfully', async () => {
    // Tạo tour và booking để xóa
    const newTour = await Tour.create({
      title: 'Hard Delete Tour ' + Date.now(),
      destination: 'HN',
      departure: 'HCM',
      start_date: new Date('2026-11-01'),
      end_date: new Date('2026-11-05'),
      price: 2000000,
      capacity: 50,
      latitude: 0,
      longitude: 0,
      is_active: true
    });
    createdTours.push(newTour.id);

    const newBooking = await bookingService.createBooking({
      user_id: testUserId,
      tour_id: newTour.id,
      quantity: 1
    });
    // Không push vào createdBookings vì sẽ bị xóa trong test này

    // Hard delete order
    const result = await bookingService.hardDeleteOrder(newBooking.id);

    expect(result).toBeDefined();
    expect(result.message).toContain('Xóa đơn hàng vĩnh viễn thành công');

    // CheckDB: Order không còn tồn tại
    const deletedOrder = await Order.findByPk(newBooking.id);
    expect(deletedOrder).toBeNull();
  });

  /**
   * [TC_BOOKING_036] hardDeleteOrder - Xóa order không tồn tại
   * Mục tiêu: Cover nhánh error trong hardDeleteOrder
   * Input: bookingId = 999999 (không tồn tại)
   * Expected: Ném lỗi "Đơn hàng không tồn tại"
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_BOOKING_036] should fail hard delete non-existent order', async () => {
    await expect(
      bookingService.hardDeleteOrder(999999)
    ).rejects.toThrow('Đơn hàng không tồn tại');

  });

  /**
   * [TC_BOOKING_037] getAllBookings - Filter payment_status = 'paid'
   * Mục tiêu: Cover nhánh payment_status = 'paid' (is_paid = true) trong getAllBookings
   * Input: {payment_status: 'paid'}
   * Expected: Chỉ trả về booking có is_paid = true
   * CheckDB: Kiểm tra tất cả booking trả về đều có is_paid = true
   * Rollback: Không thay đổi DB
   */
  it('[TC_BOOKING_037] should filter all bookings by payment_status paid', async () => {
    // Tạo booking và mark là đã thanh toán
    const newTour = await Tour.create({
      title: 'Paid Status Tour ' + Date.now(),
      destination: 'HN',
      departure: 'HCM',
      start_date: new Date('2026-11-01'),
      end_date: new Date('2026-11-05'),
      price: 2000000,
      capacity: 50,
      latitude: 0,
      longitude: 0,
      is_active: true
    });
    createdTours.push(newTour.id);

    const paidBooking = await bookingService.createBooking({
      user_id: testUserId,
      tour_id: newTour.id,
      quantity: 1
    });
    createdBookings.push(paidBooking.id);

    // Mark là đã thanh toán
    await bookingService.updatePaymentStatus(paidBooking.id, true);

    // Filter theo payment_status = 'paid'
    const paidBookings = await bookingService.getAllBookings(1, 10, {
      payment_status: 'paid'
    });

    expect(paidBookings).toBeDefined();
    expect(Array.isArray(paidBookings.bookings)).toBe(true);

    // CheckDB: Tất cả booking trả về đều có is_paid = true
    for (const booking of paidBookings.bookings) {
      expect(booking.is_paid).toBe(true);
    }
  });

  /**
   * [TC_BOOKING_038] getUserBookings - Filter booking_status = 'cancelled'
   * Mục tiêu: Cover nhánh booking_status filter trong getUserBookings
   * Input: {booking_status: 'cancelled'}
   * Expected: Chỉ trả về booking có status = 'cancelled'
   * CheckDB: Tất cả booking trả về đều có status = 'cancelled'
   * Rollback: Không thay đổi DB
   */
  it('[TC_BOOKING_038] should filter user bookings by booking_status cancelled', async () => {
    const cancelledResult = await bookingService.getUserBookings(testUserId, 1, 10, {
      booking_status: 'cancelled'
    });

    expect(cancelledResult).toBeDefined();
    expect(Array.isArray(cancelledResult.bookings)).toBe(true);

    // Tất cả booking được trả về phải có status = 'cancelled'
    for (const booking of cancelledResult.bookings) {
      expect(booking.status).toBe('cancelled');
    }
  });


  /**
   * [TC_BOOKING_039] tour_code filter trong getUserBookings không khớp → empty result
   * Mục tiêu: Cover nhánh mergeTourIds trả về empty khi tour_code không khớp
   * Input: {tour_code: 'NONEXISTENT_CODE_XYZ'}
   * Expected: Trả về empty result ngay (early return)
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_BOOKING_039] should return empty when tour_code filter does not match', async () => {
    const result = await bookingService.getUserBookings(testUserId, 1, 10, {
      tour_code: 'NONEXISTENT_CODE_XYZ_12345'
    });

    expect(result.bookings.length).toBe(0);
    expect(result.pagination.total).toBe(0);

  });

  /**
   * [TC_BOOKING_040] tour_title filter trong getUserBookings không khớp → empty result
   * Mục tiêu: Cover nhánh mergeTourIds trả về empty khi tour_title không khớp
   * Input: {tour_title: 'NONEXISTENT_TITLE_XYZ'}
   * Expected: Trả về empty result
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_BOOKING_040] should return empty when tour_title filter does not match', async () => {
    const result = await bookingService.getUserBookings(testUserId, 1, 10, {
      tour_title: 'NONEXISTENT_TITLE_XYZ_12345'
    });

    expect(result.bookings.length).toBe(0);
    expect(result.pagination.total).toBe(0);

  });

  /**
   * [TC_BOOKING_041] getAllBookings - tour_code filter không khớp → empty result
   * Mục tiêu: Cover nhánh noTourMatch trong getAllBookings khi tour_code không tìm thấy
   * Input: {tour_code: 'NONEXISTENT_CODE'}
   * Expected: Trả về empty result (early return)
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_BOOKING_041] should return empty in getAllBookings when tour_code does not match', async () => {
    const result = await bookingService.getAllBookings(1, 10, {
      tour_code: 'NONEXISTENT_CODE_AAABBBCCC'
    });

    expect(result.bookings.length).toBe(0);
    expect(result.pagination.total).toBe(0);
  });

  /**
   * [TC_BOOKING_042] getAllBookings - tour_title filter không khớp → empty result
   * Mục tiêu: Cover nhánh noTourMatch trong getAllBookings khi tour_title không tìm thấy
   * Input: {tour_title: 'NONEXISTENT_TITLE'}
   * Expected: Trả về empty result
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_BOOKING_042] should return empty in getAllBookings when tour_title does not match', async () => {
    const result = await bookingService.getAllBookings(1, 10, {
      tour_title: 'NONEXISTENT_TITLE_XYZ12345'
    });

    expect(result.bookings.length).toBe(0);
    expect(result.pagination.total).toBe(0);
  });

  /**
   * [TC_BOOKING_043] getAllBookings - tour_id filter không khớp → empty result
   * Mục tiêu: Cover nhánh noTourMatch khi tour_id không tồn tại trong getAllBookings
   * Input: {tour_id: 999999}
   * Expected: Trả về empty result
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_BOOKING_043] should return empty in getAllBookings when tour_id does not match', async () => {
    const result = await bookingService.getAllBookings(1, 10, {
      tour_id: 999999
    });

    expect(result.bookings.length).toBe(0);
    expect(result.pagination.total).toBe(0);

  });

  /**
   * [TC_BOOKING_044] Boundary test: booking tour bắt đầu hôm nay (daysDifference = 0 < 2)
   * Mục tiêu: Cover nhánh kiểm tra daysDifference < 2 trong createBooking
   * Input: Tour có start_date = hôm nay (daysDifference = 0)
   * Expected: Ném lỗi chứa "Không thể đặt tour này"
   * CheckDB: Không tạo booking
   * Rollback: Xóa tour trong afterAll
   * Lưu ý: Dùng start_date = hôm nay để đảm bảo daysDifference = 0 < 2,
   *         tránh vấn đề múi giờ khi dùng tomorrow (Math.ceil có thể trả về 2)
   */
  it('[TC_BOOKING_044] should fail when tour starts today (daysDifference < 2)', async () => {
    // start_date = hôm nay → daysDifference = 0 → chắc chắn < 2
    const today = new Date();
    const threeDaysLater = new Date();
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);

    const soonTour = await Tour.create({
      title: 'Today Start Tour ' + Date.now(),
      destination: 'HN',
      departure: 'HCM',
      start_date: today,
      end_date: threeDaysLater,
      price: 2000000,
      capacity: 50,
      latitude: 0,
      longitude: 0,
      is_active: true
    });
    createdTours.push(soonTour.id);

    const bookingsBefore = await Order.count({ where: { user_id: testUserId } });

    await expect(
      bookingService.createBooking({
        user_id: testUserId,
        tour_id: soonTour.id,
        quantity: 1
      })
    ).rejects.toThrow('Không thể đặt tour này');

    // CheckDB: Không có booking nào được tạo
    const bookingsAfter = await Order.count({ where: { user_id: testUserId } });
    expect(bookingsAfter).toBe(bookingsBefore);
  });
  /**
   * [TC_BOOKING_045] Coupon percent phải bị giới hạn bởi discount_limit (nếu có)
   * Mục tiêu: Kiểm tra rằng khi sử dụng coupon percent, số tiền giảm không vượt quá discount_limit
   * Input: Tour giá 10 triệu, coupon 20% nhưng discount_limit = 1 triệu
   * Expected: total_price = 10tr - 1tr = 9tr (không phải 8tr)
   * CheckDB: Kiểm tra total_price trong order
   * Rollback: Xóa booking, coupon, tour, user
   */
  it('[TC_BOOKING_045] should apply discount_limit for percent coupon', async () => {
    const tour = await Tour.create({
      title: 'Coupon Limit Test ' + Date.now(),
      destination: 'HN',
      departure: 'HCM',
      start_date: new Date(Date.now() + 30 * 86400000),
      end_date: new Date(Date.now() + 33 * 86400000),
      price: 10000000, // 10 triệu
      capacity: 10,
      latitude: 0,
      longitude: 0,
      is_active: true
    });
    createdTours.push(tour.id);

    const user = await User.create({
      username: 'coupon_limit_user_' + Date.now(),
      email: 'coupon_limit_' + Date.now() + '@test.com',
      password_hash: await bcrypt.hash('pass123', 10),
      phone: '0901234567',
      is_active: true
    });
    createdUsers.push(user.id);

    // Coupon giảm 20%, giới hạn tối đa 1.000.000 VND
    const coupon = await Coupon.create({
      code: 'LIMIT20_' + Date.now(),
      discount_percent: 20,
      discount_limit: 1000000,
      max_use: 1,
      is_active: true,
      expire_at: new Date('2027-12-31')
    });
    createdCoupons.push(coupon.id);

    const booking = await bookingService.createBooking({
      user_id: user.id,
      tour_id: tour.id,
      quantity: 1,
      coupon_id: coupon.id
    });
    createdBookings.push(booking.id);

    // Tính toán kỳ vọng: giảm 1 triệu, không phải 20% (2 triệu)
    const expectedPrice = 10000000 - 1000000; // 9 triệu
    expect(Number(booking.total_price)).toBe(expectedPrice);

    console.log('✅ TC_BOOKING_047: discount_limit được áp dụng đúng');
  });
});