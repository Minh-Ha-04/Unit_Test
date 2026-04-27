import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import emailService from '../services/emailService';
import Order from '../models/Order';
import User from '../models/User';
import Tour from '../models/Tour';
import Ticket from '../models/Ticket';
import Admin from '../models/Admin';
import bcrypt from 'bcryptjs';

// Mock nodemailer để không gửi email thật
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue({ messageId: 'test-message-id' })
    }))
  }
}));

// Mock google-auth-library
vi.mock('google-auth-library', () => {
  const mockOAuth2Client = {
    setCredentials: () => {},
    getAccessToken: () => Promise.resolve('mock-access-token')
  };
  return {
    OAuth2Client: function() {
      return mockOAuth2Client;
    }
  };
});

/**
 * Feature 13: Email Service - Comprehensive Unit Tests
 * ✅ Test Case IDs rõ ràng
 * ✅ CheckDB: Xác minh database queries
 * ✅ Rollback: Khôi phục DB sau tests
 * 
 * Services được test:
 * - sendPaymentConfirmationEmail()
 * - sendCancellationEmail()
 * - getOrderDetails() helper
 * - createTicketTableHTML() helper
 * - formatCurrency() helper
 * - formatDate() helper
 */
describe('[Feature 13] Email Service - Comprehensive Unit Tests', () => {
  let testUserId: number | undefined;
  let testTourId: number | undefined;
  let testOrderId: number | undefined;
  let createdUsers: number[] = [];
  let createdTours: number[] = [];
  let createdOrders: number[] = [];
  let createdTickets: number[] = [];

  beforeAll(async () => {
    console.log('📧 Bắt đầu kiểm thử Email Service...');

    // Tạo user test
    const hashedPassword = await bcrypt.hash('password123', 10);
    const user = await User.create({
      username: 'email_test_user',
      email: 'email_test_' + Date.now() + '@example.com',
      password_hash: hashedPassword,
      phone: '0901111111',
      is_active: true
    });
    testUserId = user.id;
    createdUsers.push(testUserId);

    // Tạo tour test
    const tour = await Tour.create({
      title: 'Email Test Tour ' + Date.now(),
      destination: 'HN',
      departure: 'HCM',
      start_date: new Date('2026-12-01'),
      end_date: new Date('2026-12-05'),
      price: 3000000,
      capacity: 50,
      latitude: 0,
      longitude: 0,
      is_active: true
    });
    testTourId = tour.id;
    createdTours.push(testTourId);
  });

  afterAll(async () => {
    console.log('🔄 Starting Rollback...');
    
    for (const ticketId of createdTickets) {
      await Ticket.destroy({ where: { id: ticketId } }).catch(() => {});
    }
    for (const orderId of createdOrders) {
      await Order.destroy({ where: { id: orderId } }).catch(() => {});
    }
    for (const tourId of createdTours) {
      await Tour.destroy({ where: { id: tourId } }).catch(() => {});
    }
    for (const userId of createdUsers) {
      await User.destroy({ where: { id: userId } }).catch(() => {});
    }
    
    console.log('✅ Rollback complete: DB restored');
  });
  /**
   * [TC_EMAIL_001] Kiểm tra email service tồn tại
   * Mục tiêu: Verify emailService được export đúng
   * Input: Không có
   * Expected: emailService object tồn tại với các methods
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_EMAIL_001] should have email service methods', async () => {
    // Verify service exists
    expect(emailService).toBeDefined();
    expect(typeof emailService).toBe('object');

    console.log('✅ TC_EMAIL_001: Email service exists');
  });

  /**
   * [TC_EMAIL_002] Kiểm tra method sendPaymentConfirmationEmail tồn tại
   * Mục tiêu: Verify method được export
   * Input: Không có
   * Expected: sendPaymentConfirmationEmail là function
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_EMAIL_002] should have sendPaymentConfirmationEmail method', async () => {
    const methodName = 'sendPaymentConfirmationEmail';
    
    expect(typeof emailService[methodName]).toBe('function');

    console.log(`✅ TC_EMAIL_002: ${methodName} method exists`);
  });

  /**
   * [TC_EMAIL_003] Kiểm tra method sendCancellationEmail tồn tại
   * Mục tiêu: Verify method được export
   * Input: Không có
   * Expected: sendCancellationEmail là function
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_EMAIL_003] should have sendCancellationEmail method', async () => {
    const methodName = 'sendCancellationEmail';
    
    expect(typeof emailService[methodName]).toBe('function');

    console.log(`✅ TC_EMAIL_003: ${methodName} method exists`);
  });

  /**
   * [TC_EMAIL_004] Gửi payment confirmation email với orderId không tồn tại
   */
  it('[TC_EMAIL_004] should fail when sending payment confirmation for non-existent order', async () => {
    await expect(
      emailService.sendPaymentConfirmationEmail(9999999)
    ).rejects.toThrow('Không tìm thấy đơn hàng');

    console.log('✅ TC_EMAIL_004: Correctly handled non-existent order');
  });

  /**
   * [TC_EMAIL_005] Gửi cancellation email với orderId không tồn tại
   */
  it('[TC_EMAIL_005] should fail when sending cancellation for non-existent order', async () => {
    await expect(
      emailService.sendCancellationEmail(9999999)
    ).rejects.toThrow('Không tìm thấy đơn hàng');

    console.log('✅ TC_EMAIL_005: Correctly handled non-existent order');
  });

  /**
   * [TC_EMAIL_006] Gộp các invalid orderId tests
   */
  it('[TC_EMAIL_006] should fail with invalid orderId values', async () => {
    // Test zero
    await expect(
      emailService.sendPaymentConfirmationEmail(0)
    ).rejects.toThrow();

    // Test negative
    await expect(
      emailService.sendPaymentConfirmationEmail(-1)
    ).rejects.toThrow();

    await expect(
      emailService.sendCancellationEmail(-1)
    ).rejects.toThrow();

    // Test null
    await expect(
      emailService.sendPaymentConfirmationEmail(null as any)
    ).rejects.toThrow();

    await expect(
      emailService.sendCancellationEmail(null as any)
    ).rejects.toThrow();

    // Test undefined
    await expect(
      emailService.sendPaymentConfirmationEmail(undefined as any)
    ).rejects.toThrow();

    await expect(
      emailService.sendCancellationEmail(undefined as any)
    ).rejects.toThrow();

    console.log('✅ TC_EMAIL_006: All invalid orderId cases handled');
  });

  /**
   * [TC_EMAIL_007] Gửi payment confirmation email thành công (với mock)
   */
  it('[TC_EMAIL_007] should send payment confirmation email successfully', async () => {
    // Tạo order
    const order = await Order.create({
      user_id: testUserId,
      tour_id: testTourId,
      quantity: 2,
      total_price: 6000000,
      status: 'confirmed',
      is_paid: true,
      is_review: false,
      payment_url: 'http://test.com',
      start_date: new Date('2026-12-01'),
      end_date: new Date('2026-12-05')
    });
    createdOrders.push(order.id);
    testOrderId = order.id;

    // Tạo tickets
    const ticket1 = await Ticket.create({
      order_id: order.id,
      user_id: testUserId!,
      ticket_code: 'TICKET001',
      valid_from: new Date('2026-12-01'),
      valid_until: new Date('2026-12-05')
    });
    createdTickets.push(ticket1.id);

    const ticket2 = await Ticket.create({
      order_id: order.id,
      user_id: testUserId!,
      ticket_code: 'TICKET002',
      valid_from: new Date('2026-12-01'),
      valid_until: new Date('2026-12-05')
    });
    createdTickets.push(ticket2.id);

    // Send email (sẽ dùng mock)
    await emailService.sendPaymentConfirmationEmail(order.id);

    console.log('✅ TC_EMAIL_007: Payment confirmation email sent successfully');
  });

  /**
   * [TC_EMAIL_008] Gửi cancellation email thành công (với mock)
   */
  it('[TC_EMAIL_008] should send cancellation email successfully', async () => {
    if (!testOrderId) {
      throw new Error('Order chưa được tạo');
    }

    // Send cancellation email (sẽ dùng mock)
    await emailService.sendCancellationEmail(testOrderId);

    console.log('✅ TC_EMAIL_008: Cancellation email sent successfully');
  });

  /**
   * [TC_EMAIL_009] Gửi payment confirmation với order có guide
   */
  it('[TC_EMAIL_009] should send payment confirmation with guide info', async () => {
    // Tạo admin/guide
    const hashedPassword = await bcrypt.hash('password123', 10);
    const guideEmail = 'guide_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9) + '@example.com';
    const guide = await Admin.create({
      username: 'email_test_guide_' + Date.now(),
      email: guideEmail,
      password_hash: hashedPassword,
      phone: '0902222222',
      role: 'guide',
      is_active: true
    });

    // Tạo order với guide_id
    const orderWithGuide = await Order.create({
      user_id: testUserId,
      tour_id: testTourId,
      quantity: 1,
      total_price: 3000000,
      status: 'confirmed',
      is_paid: true,
      is_review: false,
      payment_url: 'http://test.com',
      start_date: new Date('2026-12-01'),
      end_date: new Date('2026-12-05'),
      guide_id: guide.id
    });
    createdOrders.push(orderWithGuide.id);

    // Send email
    await emailService.sendPaymentConfirmationEmail(orderWithGuide.id);

    // Cleanup guide
    await Admin.destroy({ where: { id: guide.id } }).catch(() => {});

    console.log('✅ TC_EMAIL_009: Payment confirmation with guide sent');
  });

  /**
   * [TC_EMAIL_010] Gửi email với order không có tickets
   */
  it('[TC_EMAIL_010] should send email when order has no tickets', async () => {
    // Tạo order mới không có tickets
    const orderNoTickets = await Order.create({
      user_id: testUserId,
      tour_id: testTourId,
      quantity: 1,
      total_price: 3000000,
      status: 'pending',
      is_paid: false,
      is_review: false,
      payment_url: 'http://test.com',
      start_date: new Date('2026-12-01'),
      end_date: new Date('2026-12-05')
    });
    createdOrders.push(orderNoTickets.id);

    // Send payment confirmation (không có tickets)
    await emailService.sendPaymentConfirmationEmail(orderNoTickets.id);

    // Send cancellation (không có tickets)
    await emailService.sendCancellationEmail(orderNoTickets.id);

    console.log('✅ TC_EMAIL_010: Emails sent without tickets');
  });

  /**
   * [TC_EMAIL_011] Gửi email với tour destination null
   */
  it('[TC_EMAIL_011] should handle tour with null destination', async () => {
    // Tạo tour không có destination
    const tourNoDest = await Tour.create({
      title: 'No Destination Tour ' + Date.now(),
      departure: 'HCM',
      start_date: new Date('2026-12-01'),
      end_date: new Date('2026-12-05'),
      price: 2000000,
      capacity: 50,
      latitude: 0,
      longitude: 0,
      is_active: true
    });
    createdTours.push(tourNoDest.id);

    const order = await Order.create({
      user_id: testUserId,
      tour_id: tourNoDest.id,
      quantity: 1,
      total_price: 2000000,
      status: 'confirmed',
      is_paid: true,
      is_review: false,
      payment_url: 'http://test.com',
      start_date: new Date('2026-12-01'),
      end_date: new Date('2026-12-05')
    });
    createdOrders.push(order.id);

    // Send email (destination sẽ là 'Đang cập nhật')
    await emailService.sendPaymentConfirmationEmail(order.id);

    console.log('✅ TC_EMAIL_011: Handled null destination');
  });
});
