import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import emailService from '../services/emailService';
import Order from '../models/Order';
import User from '../models/User';
import Tour from '../models/Tour';
import Ticket from '../models/Ticket';
import Admin from '../models/Admin';
import bcrypt from 'bcryptjs';

const { sendMailMock } = vi.hoisted(() => ({
  sendMailMock: vi.fn().mockResolvedValue({ messageId: 'test-message-id' })
}));

// Mock nodemailer
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: sendMailMock
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
    OAuth2Client: function () {
      return mockOAuth2Client;
    }
  };
});

describe('[Feature 13] Email Service - Comprehensive Unit Tests', () => {
  let testUserId: number | undefined;
  let testTourId: number | undefined;
  let testOrderId: number | undefined;
  let createdUsers: number[] = [];
  let createdTours: number[] = [];
  let createdOrders: number[] = [];
  let createdTickets: number[] = [];

  beforeAll(async () => {
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
  });

  // Reset mock trước mỗi test
  beforeEach(() => {
    sendMailMock.mockClear();
  });

  it('[TC_EMAIL_001] should fail when sending payment confirmation for non-existent order', async () => {
    await expect(emailService.sendPaymentConfirmationEmail(9999999)).rejects.toThrow(
      'Không tìm thấy đơn hàng'
    );
  });

  it('[TC_EMAIL_002] should fail when sending cancellation for non-existent order', async () => {
    await expect(emailService.sendCancellationEmail(9999999)).rejects.toThrow(
      'Không tìm thấy đơn hàng'
    );
  });

  it('[TC_EMAIL_003] should fail with invalid orderId values', async () => {
    await expect(emailService.sendPaymentConfirmationEmail(0)).rejects.toThrow();
    await expect(emailService.sendPaymentConfirmationEmail(-1)).rejects.toThrow();
    await expect(emailService.sendCancellationEmail(-1)).rejects.toThrow();
    await expect(emailService.sendPaymentConfirmationEmail(null as any)).rejects.toThrow();
    await expect(emailService.sendCancellationEmail(null as any)).rejects.toThrow();
    await expect(emailService.sendPaymentConfirmationEmail(undefined as any)).rejects.toThrow();
    await expect(emailService.sendCancellationEmail(undefined as any)).rejects.toThrow();
  });

  it('[TC_EMAIL_004] should send payment confirmation email successfully', async () => {
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

    await emailService.sendPaymentConfirmationEmail(order.id);

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: expect.stringContaining('@example.com'),
        subject: expect.stringContaining('Xác nhận thanh toán'),
        html: expect.stringContaining('Email Test Tour')
      })
    );
  });

  it('[TC_EMAIL_005] should send cancellation email successfully', async () => {
    if (!testOrderId) throw new Error('Order chưa được tạo');

    await emailService.sendCancellationEmail(testOrderId);

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const callArg = sendMailMock.mock.calls[0][0];
    expect(callArg.to).toContain('@example.com');
    expect(callArg.subject).toContain('Đơn hàng đã bị hủy');
    expect(callArg.html).toContain('Đơn hàng của bạn với mã');
    expect(callArg.html).toContain('Email Test Tour');
  });

  it('[TC_EMAIL_006] should send payment confirmation with guide info', async () => {
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

    await emailService.sendPaymentConfirmationEmail(orderWithGuide.id);

    const lastCall = sendMailMock.mock.calls[sendMailMock.mock.calls.length - 1][0];
    expect(lastCall.html).toContain('hướng dẫn viên');
    expect(lastCall.html).toContain(guide.username);

    await Admin.destroy({ where: { id: guide.id } }).catch(() => {});
  });

  it('[TC_EMAIL_007] should send email when order has no tickets', async () => {
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

    // Payment confirmation email
    await emailService.sendPaymentConfirmationEmail(orderNoTickets.id);
    let lastCall = sendMailMock.mock.calls[sendMailMock.mock.calls.length - 1][0];
    expect(lastCall.html).toContain('Vé của bạn sẽ được cập nhật trong ít phút');

    // Cancellation email
    await emailService.sendCancellationEmail(orderNoTickets.id);
    lastCall = sendMailMock.mock.calls[sendMailMock.mock.calls.length - 1][0];
    expect(lastCall.html).toContain('Không có vé nào được tạo cho đơn hàng này');
  });

  it('[TC_EMAIL_008] should handle tour with null destination', async () => {
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

    await emailService.sendPaymentConfirmationEmail(order.id);
    const lastCall = sendMailMock.mock.calls[sendMailMock.mock.calls.length - 1][0];
    expect(lastCall.html).toContain('Đang cập nhật'); // destination fallback
  });
  /**
 * [TC_EMAIL_009] Phát hiện XSS: kiểm tra dữ liệu có được escape không
 */
it('[TC_EMAIL_009] should escape HTML special characters to prevent XSS', async () => {
  const maliciousUsername = '<script>alert("XSS")</script>';
  const hashedPassword = await bcrypt.hash('password123', 10);
  const maliciousUser = await User.create({
    username: maliciousUsername,
    email: 'xss_test@example.com',
    password_hash: hashedPassword,
    phone: '0901111111',
    is_active: true
  });
  createdUsers.push(maliciousUser.id);

  const order = await Order.create({
    user_id: maliciousUser.id,
    tour_id: testTourId!,
    quantity: 1,
    total_price: 1000000,
    status: 'confirmed',
    is_paid: true,
    is_review: false,
    payment_url: 'http://test.com',
    start_date: new Date(),
    end_date: new Date()
  });
  createdOrders.push(order.id);

  await emailService.sendPaymentConfirmationEmail(order.id);

  const lastCall = sendMailMock.mock.calls[sendMailMock.mock.calls.length - 1][0];
  const html = lastCall.html;

  expect(html).not.toContain('<script>');
  expect(html).toContain('&lt;script&gt;alert("XSS")&lt;/script&gt;');
});


});