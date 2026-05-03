import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import paymentService from '../services/paymentService';
import User from '../models/User';
import Tour from '../models/Tour';
import Order from '../models/Order';
import bcrypt from 'bcryptjs';

/**
 * Feature 15: Payment Service - Comprehensive Unit Tests
 * ✅ Test Case IDs rõ ràng
 * ✅ CheckDB: Xác minh database changes
 * ✅ Rollback: Khôi phục DB sau tests
 * 
 * Services được test:
 * - createPayment()
 * - verifySignature()
 * - updateOrderPaymentStatus()
 * 
 * Lưu ý: Payment service tích hợp với MoMo API nên tests tập trung vào validation và DB operations
 */

describe('[Feature 15] Payment Service - Complete Unit Tests', () => {
  let testUserId: number | undefined;
  let testTourId: number | undefined;
  let createdUsers: number[] = [];
  let createdOrders: number[] = [];

  beforeAll(async () => {
    console.log('💳 Payment: Bắt đầu kiểm thử...');

    // Tạo user test
    const hashedPassword = await bcrypt.hash('password123', 10);
    const user = await User.create({
      username: 'payment_user',
      email: 'payment_' + Date.now() + '@example.com',
      password_hash: hashedPassword,
      phone: '0901234567',
      is_active: true
    });
    testUserId = user.id;
    createdUsers.push(testUserId);

    // Lấy tour đầu tiên
    const tour = await Tour.findOne();
    if (tour) {
      testTourId = tour.id;
    }
  });

  /**
   * Rollback toàn bộ DB về trạng thái trước khi test
   * Thứ tự xóa: Orders → Users (theo foreign key constraints)
   */
  afterAll(async () => {

    // Xóa orders trước
    for (const orderId of createdOrders) {
      await Order.destroy({ where: { id: orderId } }).catch(() => { });
    }

    // Xóa users
    for (const userId of createdUsers) {
      await User.destroy({ where: { id: userId } }).catch(() => { });
    }

  });



  /**
   * [TC_PAYMENT_001] Create payment với order không tồn tại
   * Mục tiêu: Kiểm tra error handling khi orderId không hợp lệ
   * Input: {orderId: 9999999, amount, orderInfo}
   * Expected: Ném lỗi "Đơn hàng không tồn tại"
   * CheckDB: Verify order không tồn tại
   * Rollback: Không cần 
   */
  it('[TC_PAYMENT_001] should fail creating payment for non-existent order', async () => {
    const nonExistentOrderId = 9999999;
    const orderInDb = await Order.findByPk(nonExistentOrderId);
    expect(orderInDb).toBeNull();

    await expect(
      paymentService.createPayment({
        orderId: nonExistentOrderId,
        amount: 1000000,
        orderInfo: 'Test payment for non-existent order'
      } as any)
    ).rejects.toThrow('Đơn hàng không tồn tại');
  });

  /**
     * [TC_PAYMENT_002] Verify signature với dữ liệu không hợp lệ
     * Mục tiêu: Kiểm tra hàm verifySignature từ chối signature sai hoặc thiếu trường
     * Input: 
     *   - Payload với signature sai
     *   - Payload với signature rỗng
     *   - Payload null/undefined
     * Expected: 
     *   - verifySignature trả về false cho payload sai
     *   - Ném lỗi khi input null/undefined
     * CheckDB: Không thay đổi DB
     * Rollback: Không cần
     */
  it('[TC_PAYMENT_002] should verify signature with various invalid data', async () => {
    const invalidResult = (paymentService as any).verifySignature({
      signature: 'invalid_signature_12345',
      amount: '1000000',
      orderInfo: 'test order'
    });
    expect(invalidResult).toBe(false);

    const emptyResult = (paymentService as any).verifySignature({
      signature: '',
      amount: '500000',
      orderInfo: 'test'
    });
    expect(emptyResult).toBe(false);
    expect(() => (paymentService as any).verifySignature(null)).toThrow();
    expect(() => (paymentService as any).verifySignature(undefined)).toThrow();
  });

  /**
   * [TC_PAYMENT_003] Get order by order_code
   * Mục tiêu: Kiểm tra lấy đơn hàng theo mã order_code
   * Input: 
   *   - order_code hợp lệ
   *   - order_code không tồn tại
   * Expected: 
   *   - Trả về order tương ứng
   *   - null nếu không tìm thấy
   * CheckDB: So sánh với dữ liệu order vừa tạo
   * Rollback: Xóa order đã tạo
   */
  it('[TC_PAYMENT_003] should get order by order_code', async () => {
    if (!testUserId || !testTourId) {
      throw new Error('User hoặc Tour chưa được tạo');
    }

    // Create order with order_code
    const testOrder = await Order.create({
      user_id: testUserId,
      tour_id: testTourId,
      quantity: 1,
      total_price: 500000,
      status: 'pending',
      is_paid: false,
      is_review: false,
      payment_url: 'http://test.com/payment',
      start_date: new Date('2026-12-01'),
      end_date: new Date('2026-12-05'),
      order_code: 'TEST_ORDER_' + Date.now()
    });
    createdOrders.push(testOrder.id);

    const foundOrder = await paymentService.getOrderByCode(testOrder.order_code!);
    expect(foundOrder).not.toBeNull();
    expect(foundOrder?.id).toBe(testOrder.id);

    // Test with non-existent code
    const nonExistent = await paymentService.getOrderByCode('NON_EXISTENT_CODE');
    expect(nonExistent).toBeNull();
  });

  /**
   * [TC_PAYMENT_004] Update order payment status
   * Mục tiêu: Kiểm tra cập nhật trạng thái thanh toán của đơn hàng từ false -> true
   * Input: orderId hợp lệ, isPaid = true
   * Expected: is_paid = true, status chuyển thành 'confirmed'
   * CheckDB: Xác minh is_paid được cập nhật trong DB
   * Rollback: Xóa order sau test
   */
  it('[TC_PAYMENT_004] should update order payment status', async () => {
    if (!testUserId || !testTourId) {
      throw new Error('User hoặc Tour chưa được tạo');
    }

    // Tạo order test
    const testOrder = await Order.create({
      user_id: testUserId,
      tour_id: testTourId,
      quantity: 1,
      total_price: 1000000,
      status: 'pending',
      is_paid: false,
      is_review: false,
      payment_url: 'http://test.com/payment',
      start_date: new Date('2026-12-01'),
      end_date: new Date('2026-12-05')
    });
    createdOrders.push(testOrder.id);

    // Verify order is not paid before update
    const orderBeforeUpdate = await Order.findByPk(testOrder.id);
    expect(orderBeforeUpdate?.is_paid).toBe(false);

    // Update payment status
    const updatedOrder = await paymentService.updateOrderPaymentStatus(testOrder.id, true);

    // Verify response
    expect(updatedOrder).toBeDefined();
    expect(updatedOrder.is_paid).toBe(true);

    // CheckDB: Verify is_paid changed to true in database
    const orderAfterUpdate = await Order.findByPk(testOrder.id);
    expect(orderAfterUpdate).not.toBeNull();
    expect(orderAfterUpdate?.is_paid).toBe(true);

  });

  /**
 * [TC_PAYMENT_005] Create payment với order hợp lệ
 * Mục tiêu: Kiểm tra tạo payment thành công khi order tồn tại
 * Input: orderId hợp lệ, amount = 1500000, orderInfo = 'Thanh toan don hang {orderId}'
 * Expected: Trả về payUrl, orderId, requestId
 * CheckDB: Không thay đổi DB (chỉ tạo request MoMo)
 * Rollback: Không cần (vì không lưu gì thêm)
 */
  it('[TC_PAYMENT_005] should create payment successfully', async () => {
    if (!testUserId || !testTourId) {
      throw new Error('User hoặc Tour chưa được tạo');
    }

    const testOrder = await Order.create({
      user_id: testUserId,
      tour_id: testTourId,
      quantity: 1,
      total_price: 1500000,
      status: 'pending',
      is_paid: false,
      is_review: false,
      payment_url: 'http://test.com/payment2',
      start_date: new Date('2026-12-10'),
      end_date: new Date('2026-12-15')
    });
    createdOrders.push(testOrder.id);

    const paymentResult = await paymentService.createPayment({
      orderId: testOrder.id,
      amount: 1500000,
      orderInfo: `Thanh toan don hang ${testOrder.id}`
    } as any);

    expect(paymentResult).toBeDefined();
    expect(paymentResult.payUrl).toBeDefined();
    expect(paymentResult.orderId).toBeDefined();
    expect(paymentResult.requestId).toBeDefined();
  });

  /**
   * [TC_PAYMENT_006] Create payment với amount = 0
   * Mục tiêu: Kiểm tra từ chối tạo payment khi số tiền bằng 0
   * Input: orderId hợp lệ, amount = 0
   * Expected: Ném lỗi (MoMo hoặc service từ chối)
   * CheckDB: Không thay đổi DB
   * Rollback: Xóa order sau test
   */
  it('[TC_PAYMENT_006] should fail creating payment with zero amount', async () => {
    if (!testUserId || !testTourId) {
      throw new Error('User hoặc Tour chưa được tạo');
    }

    // Tạo order test
    const testOrder = await Order.create({
      user_id: testUserId,
      tour_id: testTourId,
      quantity: 1,
      total_price: 500000,
      status: 'pending',
      is_paid: false,
      is_review: false,
      payment_url: 'http://test.com/payment3',
      start_date: new Date('2026-12-20'),
      end_date: new Date('2026-12-25')
    });
    createdOrders.push(testOrder.id);

    const zeroAmount = 0;

    await expect(
      paymentService.createPayment({
        orderId: testOrder.id,
        amount: zeroAmount,
        orderInfo: 'Payment with zero amount'
      } as any)
    ).rejects.toThrow();

  });

  /**
 * [TC_PAYMENT_007] Update order payment status với orderId không tồn tại
 * Mục tiêu: Kiểm tra xử lý khi cập nhật đơn hàng không tồn tại
 * Input: orderId = 9999999, isPaid = true
 * Expected: Ném lỗi "Đơn hàng không tồn tại"
 * CheckDB: Verify order không tồn tại
 * Rollback: Không cần
 */
  it('[TC_PAYMENT_007] should fail updating non-existent order payment status', async () => {
    const nonExistentOrderId = 9999999;

    // Verify order doesn't exist
    const orderInDb = await Order.findByPk(nonExistentOrderId);
    expect(orderInDb).toBeNull();

    await expect(
      paymentService.updateOrderPaymentStatus(nonExistentOrderId, true)
    ).rejects.toThrow();

  });

  /**
 * [TC_PAYMENT_008] Update order payment status thành false (unpay)
 * Mục tiêu: Kiểm tra cập nhật trạng thái thanh toán từ true -> false
 * Input: order đã paid, isPaid = false
 * Expected: is_paid = false
 * CheckDB: is_paid được cập nhật trong DB
 * Rollback: Xóa order sau test
 */
  it('[TC_PAYMENT_008] should update order payment status to false', async () => {
    if (!testUserId || !testTourId) {
      throw new Error('User hoặc Tour chưa được tạo');
    }

    // Tạo order đã paid
    const paidOrder = await Order.create({
      user_id: testUserId,
      tour_id: testTourId,
      quantity: 1,
      total_price: 700000,
      status: 'confirmed',
      is_paid: true, // Already paid
      is_review: false,
      payment_url: 'http://test.com/payment5',
      start_date: new Date('2027-01-01'),
      end_date: new Date('2027-01-05')
    });
    createdOrders.push(paidOrder.id);

    // Verify order is paid
    const orderBeforeUpdate = await Order.findByPk(paidOrder.id);
    expect(orderBeforeUpdate?.is_paid).toBe(true);

    // Update to unpaid
    const updatedOrder = await paymentService.updateOrderPaymentStatus(paidOrder.id, false);

    expect(updatedOrder).toBeDefined();
    expect(updatedOrder.is_paid).toBe(false);

    // CheckDB: Verify is_paid changed to false
    const orderAfterUpdate = await Order.findByPk(paidOrder.id);
    expect(orderAfterUpdate?.is_paid).toBe(false);
  });

  /**
 * [TC_PAYMENT_009] Update payment status idempotent
 * Mục tiêu: Kiểm tra cập nhật trạng thái thanh toán nhiều lần (idempotent)
 * Input: order đã paid, update nhiều lần
 * Expected: is_paid = true sau mỗi lần update
 * CheckDB: is_paid luôn là true
 * Rollback: Xóa order sau test
 */
  it('[TC_PAYMENT_009] should handle idempotent payment status update', async () => {
    if (!testUserId || !testTourId) {
      throw new Error('User hoặc Tour chưa được tạo');
    }

    const testOrder = await Order.create({
      user_id: testUserId,
      tour_id: testTourId,
      quantity: 1,
      total_price: 1000000,
      status: 'pending',
      is_paid: true, // Already paid
      is_review: false,
      payment_url: 'http://test.com/payment9',
      start_date: new Date('2027-01-21'),
      end_date: new Date('2027-01-25')
    });
    createdOrders.push(testOrder.id);

    // Update with same status
    const updatedOrder = await paymentService.updateOrderPaymentStatus(testOrder.id, true);

    expect(updatedOrder).toBeDefined();
    expect(updatedOrder.is_paid).toBe(true);

    // CheckDB: Verify status unchanged
    const orderInDb = await Order.findByPk(testOrder.id);
    expect(orderInDb?.is_paid).toBe(true);

  });

  /**
 * [TC_PAYMENT_010] Không cho phép thanh toán đơn hàng đã bị hủy
 * Mục tiêu: Kiểm tra rằng đơn hàng có status 'cancelled' không thể được đánh dấu thanh toán
 * Input: order với status='cancelled', gọi updateOrderPaymentStatus(id, true)
 * Expected: Throw lỗi hoặc is_paid không thay đổi
 * CheckDB: is_paid vẫn false, status vẫn cancelled
 * Rollback: Xóa order
 */
  it('[TC_PAYMENT_010] should NOT allow payment for cancelled order', async () => {
    if (!testUserId || !testTourId) {
      throw new Error('User hoặc Tour chưa được tạo');
    }

    // Tạo order với status cancelled
    const cancelledOrder = await Order.create({
      user_id: testUserId,
      tour_id: testTourId,
      quantity: 1,
      total_price: 500000,
      status: 'cancelled',
      is_paid: false,
      is_review: false,
      payment_url: 'http://test.com/payment_cancelled',
      start_date: new Date('2027-02-01'),
      end_date: new Date('2027-02-05')
    });
    createdOrders.push(cancelledOrder.id);

    // Thử cập nhật thanh toán
    // Service hiện tại không kiểm tra status nên sẽ thành công (lỗ hổng)
    // Ta kỳ vọng nó throw lỗi hoặc không thay đổi is_paid
    await expect(
      paymentService.updateOrderPaymentStatus(cancelledOrder.id, true)
    ).rejects.toThrow(/đã bị hủy|không thể thanh toán|cancelled/i);

    // Kiểm tra DB: is_paid vẫn false
    const orderInDb = await Order.findByPk(cancelledOrder.id);
    expect(orderInDb?.is_paid).toBe(false);
    expect(orderInDb?.status).toBe('cancelled');
  });

  /**
   * [TC_PAYMENT_011] Idempotency - không tạo vé trùng khi webhook gọi nhiều lần
   * Mục tiêu: Đảm bảo cập nhật thanh toán nhiều lần chỉ tạo vé một lần
   * Input: Gọi updateOrderPaymentStatus hai lần liên tiếp với cùng orderId, isPaid=true
   * Expected: Lần đầu tạo vé, lần sau không tạo thêm vé
   * CheckDB: Số lượng vé đúng bằng quantity
   * Rollback: Xóa order và vé
   */
  it('[TC_PAYMENT_011] should create tickets only once for idempotent payment updates', async () => {
    if (!testUserId || !testTourId) {
      throw new Error('User hoặc Tour chưa được tạo');
    }

    // Import Ticket model
    const Ticket = (await import('../models/Ticket')).default;

    // Tạo order chưa thanh toán
    const order = await Order.create({
      user_id: testUserId,
      tour_id: testTourId,
      quantity: 2,
      total_price: 1000000,
      status: 'pending',
      is_paid: false,
      is_review: false,
      payment_url: 'http://test.com/payment_idempotent',
      start_date: new Date('2027-03-01'),
      end_date: new Date('2027-03-05')
    });
    createdOrders.push(order.id);

    // Đếm ticket trước
    const ticketsBefore = await Ticket.count({ where: { order_id: order.id } });
    expect(ticketsBefore).toBe(0);

    // Lần 1: thanh toán thành công
    const updated1 = await paymentService.updateOrderPaymentStatus(order.id, true);
    expect(updated1.is_paid).toBe(true);

    // Kiểm tra ticket đã được tạo
    const ticketsAfter1 = await Ticket.count({ where: { order_id: order.id } });
    expect(ticketsAfter1).toBe(order.quantity);

    // Lần 2: gọi lại với cùng tham số (mô phỏng webhook trùng)
    const updated2 = await paymentService.updateOrderPaymentStatus(order.id, true);
    expect(updated2.is_paid).toBe(true);

    // Kiểm tra số ticket không tăng
    const ticketsAfter2 = await Ticket.count({ where: { order_id: order.id } });
    expect(ticketsAfter2).toBe(order.quantity);

  });

  /**
   * [TC_PAYMENT_012] Verify signature từ chối payload giả mạo
   * Mục tiêu: Kiểm tra verifySignature phát hiện signature sai
   * Input: Payload MoMo đã bị sửa đổi amount hoặc transId
   * Expected: verifySignature trả về false
   * CheckDB: Không cần
   * Rollback: Không
   */
  it('[TC_PAYMENT_012] should reject forged webhook signature', async () => {
    // Tạo payload giả mạo (dựa trên cấu trúc MoMo)
    const validPayload = {
      partnerCode: 'MOMO',
      orderId: 'ORDER_123',
      requestId: 'REQ_123',
      amount: 1000000,
      orderInfo: 'Thanh toan don hang',
      orderType: 'momo_wallet',
      transId: 123456,
      resultCode: 0,
      message: 'Success',
      payType: 'qr',
      responseTime: Date.now(),
      extraData: '',
      signature: 'fake_signature_abc' // Sai
    };

    const isValid = paymentService.verifySignature(validPayload);
    expect(isValid).toBe(false);

    // Test với payload thiếu trường
    const missingFieldPayload = {
      partnerCode: 'MOMO',
      amount: 1000000,
      signature: 'abc'
    };
    expect(paymentService.verifySignature(missingFieldPayload)).toBe(false);

    // Test với signature rỗng
    const emptySigPayload = { ...validPayload, signature: '' };
    expect(paymentService.verifySignature(emptySigPayload)).toBe(false);

  });
});
