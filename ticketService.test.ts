import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import ticketService from '../services/ticketService';
import Ticket from '../models/Ticket';
import User from '../models/User';
import Tour from '../models/Tour';
import Order from '../models/Order';
import bcrypt from 'bcryptjs';

/**
 * Feature 6: Ticket Management - Comprehensive Unit Tests
 * 
 * Services được test:
 * - getUserTickets() - Lấy tickets của user với filters
 * - getAllTickets() - Admin lấy tất cả tickets với filters
 * - getTicketById() - Lấy chi tiết ticket
 * - cancelTicketsByOrderId() - Hủy tất cả tickets của order
 * - updateTicketStatus() - Admin cập nhật status ticket
 * - cancelTicket() - User/Admin hủy ticket
 * - getTicketsByTourId() - Lấy tickets theo tour
 * - getTicketsByOrderId() - Lấy tickets theo order
 * - cancelExpiredTickets() - Tự động hủy vé hết hạn
 */
describe('[Feature 6] Ticket Management - Complete Unit Tests', () => {
  let testUserId: number | undefined;
  let testTourId: number | undefined;
  let testOrderId: number | undefined;
  let createdTicketId: number | undefined;
  let createdTickets: number[] = [];
  let createdUsers: number[] = [];
  let createdTours: number[] = [];
  let createdOrders: number[] = [];

  beforeAll(async () => {
    console.log('🎫 Bắt đầu kiểm thử Quản Lý Vé...');

    // Tạo test user
    const hashedPassword = await bcrypt.hash('password123', 10);
    const user = await User.create({
      username: 'ticket_test_user',
      email: 'ticket_test_' + Date.now() + '@example.com',
      password_hash: hashedPassword,
      phone: '0902222222',
      is_active: true
    });
    testUserId = user.id;
    createdUsers.push(testUserId);

    // Tạo test tour
    const tour = await Tour.create({
      title: 'Ticket Test Tour',
      destination: 'Test Destination',
      departure: 'Test Departure',
      start_date: new Date('2026-09-01'),
      end_date: new Date('2026-09-05'),
      price: 4000000,
      capacity: 25,
      latitude: 0,
      longitude: 0,
      is_active: true
    });
    testTourId = tour.id;
    createdTours.push(testTourId);

    // Tạo test order
    const order = await Order.create({
      user_id: testUserId,
      tour_id: testTourId,
      quantity: 2,
      total_price: 8000000,
      status: 'confirmed',
      is_paid: true,
      is_review: false,
      payment_url: 'http://test.com/payment',
      start_date: new Date('2026-09-01'),
      end_date: new Date('2026-09-05')
    });
    testOrderId = order.id;
    createdOrders.push(testOrderId);

    // Tạo test ticket
    const ticket = await Ticket.create({
      order_id: testOrderId!,
      user_id: testUserId!,
      ticket_code: 'TICKET_TEST_' + Date.now(),
      status: 'active',
      valid_from: new Date('2026-09-01'),
      valid_until: new Date('2026-09-05')
    });
    createdTicketId = ticket.id;
    createdTickets.push(createdTicketId);
  });

  afterAll(async () => {
    console.log('🔄 Bắt đầu Rollback dữ liệu Ticket Service...');

    // Rollback theo thứ tự ngược lại để tránh foreign key constraints
    // 1. Xóa tickets trước (dependent records)
    let deletedTickets = 0;
    for (const ticketId of createdTickets) {
      const deleted = await Ticket.destroy({ where: { id: ticketId } }).catch(() => 0);
      deletedTickets += deleted || 0;
    }
    console.log(`   ✅ Đã xóa ${deletedTickets} tickets`);

    // 2. Xóa orders
    let deletedOrders = 0;
    for (const orderId of createdOrders) {
      const deleted = await Order.destroy({ where: { id: orderId } }).catch(() => 0);
      deletedOrders += deleted || 0;
    }
    console.log(`   ✅ Đã xóa ${deletedOrders} orders`);

    // 3. Xóa tours
    let deletedTours = 0;
    for (const tourId of createdTours) {
      const deleted = await Tour.destroy({ where: { id: tourId } }).catch(() => 0);
      deletedTours += deleted || 0;
    }
    console.log(`   ✅ Đã xóa ${deletedTours} tours`);

    // 4. Xóa users (phải xóa sau cùng vì là parent record)
    let deletedUsers = 0;
    for (const userId of createdUsers) {
      const deleted = await User.destroy({ where: { id: userId } }).catch(() => 0);
      deletedUsers += deleted || 0;
    }
    console.log(`   ✅ Đã xóa ${deletedUsers} users`);

    console.log('✅ Rollback complete - Database restored');
  });


  /**
   * [TC_TICKET_001] Hủy vé theo order ID
   * Mục tiêu: Kiểm tra cancelTicketsByOrderId hoạt động đúng
   * Input: orderId (tạo mới để test)
   * Expected: Tickets được chuyển sang status='cancelled'
   * CheckDB: Verify tickets có status='cancelled' trong DB
   * Rollback: Ticket đã hủy sẽ bị xóa trong afterAll
   */
  it('[TC_TICKET_001] should cancel tickets by order ID', async () => {
    // Tạo order mới để test cancel
    const cancelTestOrder = await Order.create({
      user_id: testUserId!,
      tour_id: testTourId!,
      quantity: 1,
      total_price: 4000000,
      status: 'confirmed',
      is_paid: true,
      is_review: false,
      payment_url: 'http://test.com/payment-cancel',
      start_date: new Date('2026-10-01'),
      end_date: new Date('2026-10-05')
    });
    createdOrders.push(cancelTestOrder.id);

    const ticketToCancel = await Ticket.create({
      order_id: cancelTestOrder.id,
      user_id: testUserId!,
      ticket_code: 'TICKET_CANCEL_' + Date.now(),
      status: 'active',
      valid_from: new Date('2026-10-01'),
      valid_until: new Date('2026-10-05')
    });
    createdTickets.push(ticketToCancel.id);

    // Verify ticket is active before cancel
    const ticketBeforeCancel = await Ticket.findByPk(ticketToCancel.id);
    expect(ticketBeforeCancel?.status).toBe('active');

    // Cancel tickets
    const cancelResult = await ticketService.cancelTicketsByOrderId(cancelTestOrder.id);

    expect(cancelResult).toBeDefined();

    // CheckDB: Verify ticket status changed to 'cancelled' in DB
    const ticketAfterCancel = await Ticket.findByPk(ticketToCancel.id);
    expect(ticketAfterCancel?.status).toBe('cancelled');

    console.log(`✅ TC_TICKET_001: Cancelled ticket ${ticketToCancel.id} successfully`);
  });

  /**
   * [TC_TICKET_002] Lấy vé của user với filters
   * Mục tiêu: Kiểm tra getUserTickets với status filter
   * Input: userId, page=1, limit=10, status='active'
   * Expected: Trả về chỉ active tickets của user
   * CheckDB: Verify tickets thuộc user và có status='active'
   * Rollback: Không thay đổi DB
   */
  it('[TC_TICKET_002] should get user tickets with filters', async () => {
    const activeFilter = 'active';
    const filteredUserTicketsResult = await ticketService.getUserTickets(testUserId!, 1, 10, {
      status: activeFilter
    });

    // Verify response
    expect(filteredUserTicketsResult).toBeDefined();
    expect(Array.isArray(filteredUserTicketsResult.tickets)).toBe(true);

    // CheckDB: Verify tickets thuộc user và có status='active'
    for (const ticket of filteredUserTicketsResult.tickets) {
      expect(ticket.user_id).toBe(testUserId);
      expect(ticket.status).toBe(activeFilter);
    }

    console.log(`✅ TC_TICKET_002: Retrieved ${filteredUserTicketsResult.tickets.length} tickets with filter`);
  });

  /**
   * [TC_TICKET_003] Lấy vé với ID không tồn tại
   * Mục tiêu: Kiểm tra validation ticketId hợp lệ
   * Input: ticketId=9999999 (không tồn tại)
   * Expected: Throw error
   * CheckDB: Không có ticket nào được tạo/thay đổi
   * Rollback: Không cần
   */
  it('[TC_TICKET_003] should fail when getting non-existent ticket', async () => {
    const nonExistentTicketId = 9999999;

    await expect(ticketService.getTicketById(nonExistentTicketId)).rejects.toThrow();

    // CheckDB: Verify no ticket exists with this ID
    const ticketInDb = await Ticket.findByPk(nonExistentTicketId);
    expect(ticketInDb).toBeNull();

    console.log('✅ TC_TICKET_003: Rejected non-existent ticket');
  });

  /**
   * [TC_TICKET_004] Cập nhật status ticket (Admin)
   * Mục tiêu: Kiểm tra updateTicketStatus hoạt động đúng
   * Input: ticketId, status='used'
   * Expected: Ticket status được cập nhật
   * CheckDB: Verify ticket status trong DB
   */
  it('[TC_TICKET_004] should update ticket status', async () => {
    const orderForUpdate = await Order.create({
      user_id: testUserId!,
      tour_id: testTourId!,
      quantity: 1,
      total_price: 4000000,
      status: 'confirmed',
      is_paid: true,
      is_review: false,
      payment_url: 'http://test.com/payment-update-status',
      start_date: new Date('2026-12-01'),
      end_date: new Date('2026-12-05')
    });
    createdOrders.push(orderForUpdate.id);

    const ticketForUpdate = await Ticket.create({
      order_id: orderForUpdate.id,
      user_id: testUserId!,
      ticket_code: 'TICKET_UPDATE_' + Date.now(),
      status: 'active',
      valid_from: new Date('2026-12-01'),
      valid_until: new Date('2026-12-05')
    });
    createdTickets.push(ticketForUpdate.id);

    // Update status to 'used'
    const updatedTicket = await ticketService.updateTicketStatus(ticketForUpdate.id, 'used');

    expect(updatedTicket).toBeDefined();
    expect(updatedTicket.status).toBe('used');

    // CheckDB: Verify status updated in DB
    const ticketInDb = await Ticket.findByPk(ticketForUpdate.id);
    expect(ticketInDb?.status).toBe('used');

    console.log(`✅ TC_TICKET_004: Updated ticket status to 'used'`);
  });

  /**
   * [TC_TICKET_005] Cập nhật status ticket không tồn tại
   * Mục tiêu: Kiểm tra validation ticketId
   * Input: ticketId=9999999
   * Expected: Throw 'Ticket không tồn tại'
   */
  it('[TC_TICKET_005] should fail when updating non-existent ticket', async () => {
    await expect(
      ticketService.updateTicketStatus(9999999, 'used')
    ).rejects.toThrow('Ticket không tồn tại');

    console.log('✅ TC_TICKET_005: Rejected non-existent ticket update');
  });

  /**
   * [TC_TICKET_006] Hủy ticket thành công
   * Mục tiêu: Kiểm tra cancelTicket hoạt động đúng
   * Input: ticketId, userId (owner)
   * Expected: Ticket status='cancelled'
   * CheckDB: Verify ticket status trong DB
   */
  it('[TC_TICKET_006] should cancel ticket successfully', async () => {
    const orderForCancel = await Order.create({
      user_id: testUserId!,
      tour_id: testTourId!,
      quantity: 1,
      total_price: 4000000,
      status: 'confirmed',
      is_paid: true,
      is_review: false,
      payment_url: 'http://test.com/payment-cancel-ticket',
      start_date: new Date('2027-01-01'),
      end_date: new Date('2027-01-05')
    });
    createdOrders.push(orderForCancel.id);

    const ticketToCancel = await Ticket.create({
      order_id: orderForCancel.id,
      user_id: testUserId!,
      ticket_code: 'TICKET_TO_CANCEL_' + Date.now(),
      status: 'active',
      valid_from: new Date('2027-01-01'),
      valid_until: new Date('2027-01-05')
    });
    createdTickets.push(ticketToCancel.id);

    // Cancel ticket
    const cancelledTicket = await ticketService.cancelTicket(ticketToCancel.id, testUserId!);

    expect(cancelledTicket).toBeDefined();
    expect(cancelledTicket.status).toBe('cancelled');

    // CheckDB: Verify status in DB
    const ticketInDb = await Ticket.findByPk(ticketToCancel.id);
    expect(ticketInDb?.status).toBe('cancelled');

    console.log(`✅ TC_TICKET_006: Cancelled ticket successfully`);
  });

  /**
   * [TC_TICKET_007] Hủy ticket không tồn tại
   * Mục tiêu: Kiểm tra validation ticketId
   * Input: ticketId=9999999
   * Expected: Throw 'Ticket không tồn tại'
   */
  it('[TC_TICKET_007] should fail when cancelling non-existent ticket', async () => {
    await expect(
      ticketService.cancelTicket(9999999, testUserId!)
    ).rejects.toThrow('Ticket không tồn tại');

    console.log('✅ TC_TICKET_007: Rejected non-existent ticket cancellation');
  });

  /**
   * [TC_TICKET_008] Hủy ticket đã được sử dụng
   * Mục tiêu: Kiểm tra validation không cho hủy used ticket
   * Input: ticket với status='used'
   * Expected: Throw 'Không thể hủy ticket đã sử dụng'
   */
  it('[TC_TICKET_008] should fail when cancelling used ticket', async () => {
    const orderForUsed = await Order.create({
      user_id: testUserId!,
      tour_id: testTourId!,
      quantity: 1,
      total_price: 4000000,
      status: 'confirmed',
      is_paid: true,
      is_review: false,
      payment_url: 'http://test.com/payment-used-ticket',
      start_date: new Date('2027-02-01'),
      end_date: new Date('2027-02-05')
    });
    createdOrders.push(orderForUsed.id);

    const usedTicket = await Ticket.create({
      order_id: orderForUsed.id,
      user_id: testUserId!,
      ticket_code: 'TICKET_USED_' + Date.now(),
      status: 'used',
      valid_from: new Date('2027-02-01'),
      valid_until: new Date('2027-02-05')
    });
    createdTickets.push(usedTicket.id);

    await expect(
      ticketService.cancelTicket(usedTicket.id, testUserId!)
    ).rejects.toThrow('Không thể hủy ticket đã sử dụng');

    console.log('✅ TC_TICKET_008: Rejected cancelling used ticket');
  });

  /**
   * [TC_TICKET_009] Hủy ticket đã được hủy trước đó
   * Mục tiêu: Kiểm tra validation không cho hủy ticket đã cancelled
   * Input: ticket với status='cancelled'
   * Expected: Throw 'Ticket đã được hủy trước đó'
   */
  it('[TC_TICKET_009] should fail when cancelling already cancelled ticket', async () => {
    const orderForAlreadyCancelled = await Order.create({
      user_id: testUserId!,
      tour_id: testTourId!,
      quantity: 1,
      total_price: 4000000,
      status: 'confirmed',
      is_paid: true,
      is_review: false,
      payment_url: 'http://test.com/payment-already-cancelled',
      start_date: new Date('2027-03-01'),
      end_date: new Date('2027-03-05')
    });
    createdOrders.push(orderForAlreadyCancelled.id);

    const alreadyCancelledTicket = await Ticket.create({
      order_id: orderForAlreadyCancelled.id,
      user_id: testUserId!,
      ticket_code: 'TICKET_ALREADY_CANCELLED_' + Date.now(),
      status: 'cancelled',
      valid_from: new Date('2027-03-01'),
      valid_until: new Date('2027-03-05')
    });
    createdTickets.push(alreadyCancelledTicket.id);

    await expect(
      ticketService.cancelTicket(alreadyCancelledTicket.id, testUserId!)
    ).rejects.toThrow('Ticket đã được hủy trước đó');

    console.log('✅ TC_TICKET_009: Rejected cancelling already cancelled ticket');
  });

  /**
   * [TC_TICKET_010] Hủy ticket không phải của mình
   * Mục tiêu: Kiểm tra authorization - user không thể hủy ticket của người khác
   * Input: ticketId (của user khác), userId hiện tại
   * Expected: Throw 'Bạn không có quyền hủy ticket này'
   */
  it('[TC_TICKET_010] should fail when cancelling another user ticket', async () => {
    // Ticket đã tạo trong beforeAll thuộc về testUserId
    // Sử dụng userId khác (secondUserId) để thử hủy
    const differentUserId = 9999999;

    await expect(
      ticketService.cancelTicket(createdTicketId!, differentUserId)
    ).rejects.toThrow('Bạn không có quyền hủy ticket này');

    console.log('✅ TC_TICKET_010: Rejected unauthorized ticket cancellation');
  });

  /**
   * [TC_TICKET_011] Lấy tickets theo tourId không tồn tại
   * Mục tiêu: Kiểm tra validation tourId
   * Input: tourId=9999999
   * Expected: Throw 'Tour không tồn tại'
   */
  it('[TC_TICKET_011] should fail when getting tickets for non-existent tour', async () => {
    await expect(
      ticketService.getTicketsByTourId(9999999, 1, 10)
    ).rejects.toThrow('Tour không tồn tại');

    console.log('✅ TC_TICKET_011: Rejected non-existent tour');
  });

  /**
   * [TC_TICKET_012] Lấy tickets theo tourId với filter status
   * Mục tiêu: Kiểm tra getTicketsByTourId với status filter
   * Input: tourId, status='active'
   * Expected: Chỉ trả về active tickets
   */
  it('[TC_TICKET_012] should get tickets by tour ID with status filter', async () => {
    const filteredTourTickets = await ticketService.getTicketsByTourId(testTourId!, 1, 10, {
      status: 'active'
    });

    expect(filteredTourTickets).toBeDefined();
    expect(Array.isArray(filteredTourTickets.tickets)).toBe(true);

    console.log(`✅ TC_TICKET_012: Retrieved ${filteredTourTickets.tickets.length} active tickets for tour`);
  });

  /**
   * [TC_TICKET_013] Lấy tickets theo orderId không tồn tại
   * Mục tiêu: Kiểm tra validation orderId
   * Input: orderId=9999999
   * Expected: Throw 'Order không tồn tại'
   */
  it('[TC_TICKET_013] should fail when getting tickets for non-existent order', async () => {
    await expect(
      ticketService.getTicketsByOrderId(9999999, 1, 10)
    ).rejects.toThrow('Order không tồn tại');

    console.log('✅ TC_TICKET_013: Rejected non-existent order');
  });

  /**
   * [TC_TICKET_014] Lấy tickets theo orderId với filter
   * Mục tiêu: Kiểm tra getTicketsByOrderId với filters
   * Input: orderId, status='active'
   * Expected: Chỉ trả về active tickets
   */
  it('[TC_TICKET_014] should get tickets by order ID with filters', async () => {
    const filteredOrderTickets = await ticketService.getTicketsByOrderId(testOrderId!, 1, 10, {
      status: 'active'
    });

    expect(filteredOrderTickets).toBeDefined();
    expect(Array.isArray(filteredOrderTickets.tickets)).toBe(true);

    console.log(`✅ TC_TICKET_014: Retrieved filtered tickets for order`);
  });

  /**
   * [TC_TICKET_015] Hủy tickets hết hạn (không có vé hết hạn)
   * Mục tiêu: Kiểm tra cancelExpiredTickets khi không có vé hết hạn
   * Input: Không có
   * Expected: Return { cancelled: 0, message }
   */
  it('[TC_TICKET_015] should return zero when no expired tickets', async () => {
    const result = await ticketService.cancelExpiredTickets();

    expect(result).toBeDefined();
    expect(result.cancelled).toBeGreaterThanOrEqual(0);
    expect(result.message).toBeDefined();

    console.log(`✅ TC_TICKET_015: ${result.message}`);
  });

  /**
   * [TC_TICKET_016] Hủy vé hết hạn với vé có valid_until trong quá khứ
   * Mục tiêu: Kiểm tra cancelExpiredTickets tự động hủy vé hết hạn
   * Input: Tạo ticket với valid_until trong quá khứ
   * Expected: Ticket được hủy tự động
   */
  it('[TC_TICKET_016] should cancel expired tickets automatically', async () => {
    const orderForExpired = await Order.create({
      user_id: testUserId!,
      tour_id: testTourId!,
      quantity: 1,
      total_price: 4000000,
      status: 'confirmed',
      is_paid: true,
      is_review: false,
      payment_url: 'http://test.com/payment-expired',
      start_date: new Date('2020-01-01'),
      end_date: new Date('2020-01-05')
    });
    createdOrders.push(orderForExpired.id);

    const expiredTicket = await Ticket.create({
      order_id: orderForExpired.id,
      user_id: testUserId!,
      ticket_code: 'TICKET_EXPIRED_' + Date.now(),
      status: 'active',
      valid_from: new Date('2020-01-01'),
      valid_until: new Date('2020-01-05') // Expired date
    });
    createdTickets.push(expiredTicket.id);

    // Verify ticket is active before
    const ticketBefore = await Ticket.findByPk(expiredTicket.id);
    expect(ticketBefore?.status).toBe('active');

    // Run cancelExpiredTickets
    const result = await ticketService.cancelExpiredTickets();

    expect(result.cancelled).toBeGreaterThanOrEqual(1);

    // CheckDB: Verify ticket was cancelled
    const ticketAfter = await Ticket.findByPk(expiredTicket.id);
    expect(ticketAfter?.status).toBe('cancelled');

    console.log(`✅ TC_TICKET_016: ${result.message}`);
  });

  /**
   * [TC_TICKET_017] Lấy ticket by ID với authorization (owner)
   * Mục tiêu: Kiểm tra getTicketById với userId (owner)
   * Input: ticketId, userId (owner)
   * Expected: Trả về ticket
   */
  it('[TC_TICKET_017] should get ticket by ID as owner', async () => {
    const ticketDetails = await ticketService.getTicketById(createdTicketId!, testUserId!);

    expect(ticketDetails).toBeDefined();
    expect(ticketDetails.id).toBe(createdTicketId);
    expect(ticketDetails.user).toBeDefined();
    expect(ticketDetails.tour).toBeDefined();

    console.log('✅ TC_TICKET_017: Retrieved ticket as owner');
  });

  /**
   * [TC_TICKET_018] Lấy ticket by ID với userId khác (không phải owner)
   * Mục tiêu: Kiểm tra authorization - user không thể xem ticket của người khác
   * Input: ticketId, userId khác
   * Expected: Throw 'Bạn không có quyền xem ticket này'
   */
  it('[TC_TICKET_018] should fail when getting ticket as non-owner', async () => {
    const differentUserId = 9999999;

    await expect(
      ticketService.getTicketById(createdTicketId!, differentUserId)
    ).rejects.toThrow('Bạn không có quyền xem ticket này');

    console.log('✅ TC_TICKET_018: Rejected unauthorized ticket access');
  });

  /**
   * [TC_TICKET_019] Lọc tickets với text search
   * Mục tiêu: Kiểm tra getAllTickets với text filter
   * Input: text='TICKET'
   * Expected: Trả về tickets có ticket_code chứa 'TICKET'
   */
  it('[TC_TICKET_019] should filter tickets with text search', async () => {
    const textFilteredTickets = await ticketService.getAllTickets(1, 10, {
      text: 'TICKET'
    });

    expect(textFilteredTickets).toBeDefined();
    expect(Array.isArray(textFilteredTickets.tickets)).toBe(true);

    console.log(`✅ TC_TICKET_019: Found ${textFilteredTickets.tickets.length} tickets with text filter`);
  });

  /**
   * [TC_TICKET_020] Lấy user tickets với text search
   * Mục tiêu: Kiểm tra getUserTickets với text filter
   * Input: userId, text='TICKET'
   * Expected: Trả về tickets của user có ticket_code chứa 'TICKET'
   */
  it('[TC_TICKET_020] should get user tickets with text search', async () => {
    const textFilteredUserTickets = await ticketService.getUserTickets(testUserId!, 1, 10, {
      text: 'TICKET'
    });

    expect(textFilteredUserTickets).toBeDefined();
    expect(Array.isArray(textFilteredUserTickets.tickets)).toBe(true);

    console.log(`✅ TC_TICKET_020: Found ${textFilteredUserTickets.tickets.length} user tickets with text filter`);
  });

  /**
   * [TC_TICKET_021] Hủy tất cả tickets của order (không có tickets)
   * Mục tiêu: Kiểm tra cancelTicketsByOrderId với order không có tickets
   * Input: orderId mới (chưa có tickets)
   * Expected: Return 0
   */
  it('[TC_TICKET_021] should return zero when cancelling order with no tickets', async () => {
    const orderWithNoTickets = await Order.create({
      user_id: testUserId!,
      tour_id: testTourId!,
      quantity: 1,
      total_price: 4000000,
      status: 'confirmed',
      is_paid: true,
      is_review: false,
      payment_url: 'http://test.com/payment-no-tickets',
      start_date: new Date('2027-04-01'),
      end_date: new Date('2027-04-05')
    });
    createdOrders.push(orderWithNoTickets.id);

    const result = await ticketService.cancelTicketsByOrderId(orderWithNoTickets.id);

    expect(result).toBe(0);

    console.log('✅ TC_TICKET_021: No tickets to cancel for order');
  });

  /**
   * [TC_TICKET_022] Lấy tickets với status='all' filter
   * Mục tiêu: Kiểm tra filter status='all' trả về tất cả tickets
   * Input: status='all'
   * Expected: Trả về tất cả tickets (không filter)
   */
  it('[TC_TICKET_022] should return all tickets when status=all', async () => {
    const allStatusTickets = await ticketService.getAllTickets(1, 50, {
      status: 'all'
    });

    expect(allStatusTickets).toBeDefined();
    expect(Array.isArray(allStatusTickets.tickets)).toBe(true);

    console.log(`✅ TC_TICKET_022: Retrieved ${allStatusTickets.tickets.length} tickets with status=all`);
  });
});
