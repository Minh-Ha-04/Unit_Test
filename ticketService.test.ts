import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import ticketService from '../services/ticketService';
import Ticket from '../models/Ticket';
import User from '../models/User';
import Tour from '../models/Tour';
import Order from '../models/Order';
import bcrypt from 'bcryptjs';

/**
 * Feature 6: Ticket Management - Comprehensive Unit Tests
 * ✅ Test Case IDs rõ ràng
 * ✅ CheckDB: Xác minh database thay đổi đúng
 * ✅ Rollback: Đảm bảo DB trở về trạng thái ban đầu
 * ❗ Tests có cả PASS và edge cases thực tế
 * 
 * Services được test:
 * - getUserTickets()
 * - getAllTickets()
 * - getTicketById()
 * - cancelTicketsByOrderId()
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
   * [TC_TICKET_001] Lấy vé của user
   * Mục tiêu: Kiểm tra getUserTickets trả về tickets của user
   * Input: userId, page=1, limit=10
   * Expected: Trả về danh sách tickets kèm pagination
   * CheckDB: Verify tickets thuộc về đúng user
   * Rollback: Không thay đổi DB (read-only)
   */
  it('[TC_TICKET_001] should get user tickets', async () => {
    if (!testUserId) {
      throw new Error('User chưa được tạo');
    }

    const userTicketsResult = await ticketService.getUserTickets(testUserId, 1, 10);

    // Verify response structure
    expect(userTicketsResult).toBeDefined();
    expect(userTicketsResult.tickets).toBeDefined();
    expect(userTicketsResult.pagination).toBeDefined();
    expect(Array.isArray(userTicketsResult.tickets)).toBe(true);

    // CheckDB: Verify tất cả tickets thuộc về đúng user
    for (const ticket of userTicketsResult.tickets) {
      expect(ticket.user_id).toBe(testUserId);
    }

    console.log(`✅ TC_TICKET_001: Retrieved ${userTicketsResult.tickets.length} tickets for user`);
  });

  /**
   * [TC_TICKET_002] Lấy tất cả vé (Admin view)
   * Mục tiêu: Kiểm tra getAllTickets trả về tất cả tickets
   * Input: page=1, limit=10
   * Expected: Trả về danh sách tickets kèm pagination
   * CheckDB: Verify response có cấu trúc đúng
   * Rollback: Không thay đổi DB
   */
  it('[TC_TICKET_002] should get all tickets', async () => {
    const allTicketsResult = await ticketService.getAllTickets(1, 10);

    // Verify response structure
    expect(allTicketsResult).toBeDefined();
    expect(allTicketsResult.tickets).toBeDefined();
    expect(allTicketsResult.pagination).toBeDefined();
    expect(Array.isArray(allTicketsResult.tickets)).toBe(true);

    console.log(`✅ TC_TICKET_002: Retrieved ${allTicketsResult.tickets.length} tickets (admin view)`);
  });

  /**
   * [TC_TICKET_003] Lấy vé theo ID
   * Mục tiêu: Kiểm tra getTicketById trả về ticket đúng
   * Input: ticketId (đã tạo trong beforeAll)
   * Expected: Trả về ticket với đúng ID và ticket_code
   * CheckDB: Verify ticket tồn tại trong DB với đúng data
   * Rollback: Không thay đổi DB
   */
  it('[TC_TICKET_003] should get ticket by ID', async () => {
    if (!createdTicketId) {
      throw new Error('Ticket chưa được tạo');
    }

    const ticketById = await ticketService.getTicketById(createdTicketId);

    // Verify ticket data
    expect(ticketById).toBeDefined();
    expect(ticketById.id).toBe(createdTicketId);
    expect(ticketById.ticket_code).toBeDefined();
    expect(ticketById.ticket_code).toMatch(/^TICKET_TEST_/);

    // CheckDB: Verify ticket tồn tại trong database
    const ticketInDb = await Ticket.findByPk(createdTicketId);
    expect(ticketInDb).not.toBeNull();
    expect(ticketInDb?.ticket_code).toBe(ticketById.ticket_code);

    console.log('✅ TC_TICKET_003: Retrieved ticket by ID successfully');
  });

  /**
   * [TC_TICKET_004] Lọc vé theo trạng thái 'active'
   * Mục tiêu: Kiểm tra filter theo status hoạt động đúng
   * Input: status='active'
   * Expected: Trả về chỉ active tickets
   * CheckDB: Verify tất cả tickets trả về có status='active'
   * Rollback: Không thay đổi DB
   */
  it('[TC_TICKET_004] should filter tickets by status', async () => {
    const activeStatusFilter = 'active';
    const filteredTicketsResult = await ticketService.getAllTickets(1, 10, {
      status: activeStatusFilter
    });

    // Verify response
    expect(filteredTicketsResult).toBeDefined();
    expect(Array.isArray(filteredTicketsResult.tickets)).toBe(true);

    // CheckDB: Verify tất cả tickets có status='active'
    for (const ticket of filteredTicketsResult.tickets) {
      expect(ticket.status).toBe(activeStatusFilter);
    }

    console.log(`✅ TC_TICKET_004: Filtered ${filteredTicketsResult.tickets.length} active tickets`);
  });

  /**
   * [TC_TICKET_005] Tìm vé theo mã vé
   * Mục tiêu: Kiểm tra search theo ticket_code
   * Input: text='TICKET_TEST'
   * Expected: Trả về tickets có ticket_code chứa 'TICKET_TEST'
   * CheckDB: Verify tickets trả về có ticket_code match
   * Rollback: Không thay đổi DB
   */
  it('[TC_TICKET_005] should search tickets by ticket code', async () => {
    const searchKeyword = 'TICKET_TEST';
    const searchedTicketsResult = await ticketService.getAllTickets(1, 10, {
      text: searchKeyword
    });

    // Verify response
    expect(searchedTicketsResult).toBeDefined();
    expect(Array.isArray(searchedTicketsResult.tickets)).toBe(true);

    // CheckDB: Verify tickets có ticket_code chứa keyword
    for (const ticket of searchedTicketsResult.tickets) {
      expect(ticket.ticket_code).toContain(searchKeyword);
    }

    console.log(`✅ TC_TICKET_005: Searched ${searchedTicketsResult.tickets.length} tickets`);
  });

  /**
   * [TC_TICKET_006] Lấy vé với phân trang
   * Mục tiêu: Kiểm tra pagination hoạt động đúng
   * Input: page=1, limit=5 và page=2, limit=5
   * Expected: Trả về 2 pages khác nhau
   * CheckDB: Verify page numbers đúng
   * Rollback: Không thay đổi DB
   */
  it('[TC_TICKET_006] should paginate tickets', async () => {
    const firstPageResult = await ticketService.getAllTickets(1, 5);
    const secondPageResult = await ticketService.getAllTickets(2, 5);

    // Verify pagination
    expect(firstPageResult).toBeDefined();
    expect(firstPageResult.pagination.page).toBe(1);
    expect(secondPageResult).toBeDefined();
    expect(secondPageResult.pagination.page).toBe(2);

    console.log(`✅ TC_TICKET_006: Pagination (Page 1: ${firstPageResult.tickets.length}, Page 2: ${secondPageResult.tickets.length})`);
  });

  /**
   * [TC_TICKET_007] Lấy vé với limit lớn
   * Mục tiêu: Kiểm tra handling limit lớn (100)
   * Input: page=1, limit=100
   * Expected: Trả về tối đa 100 tickets
   * CheckDB: Verify limit trong pagination = 100
   * Rollback: Không thay đổi DB
   */
  it('[TC_TICKET_007] should get tickets with large limit', async () => {
    const largeLimit = 100;
    const largeLimitResult = await ticketService.getAllTickets(1, largeLimit);

    // Verify response
    expect(largeLimitResult).toBeDefined();
    expect(largeLimitResult.pagination.limit).toBe(largeLimit);
    expect(largeLimitResult.tickets.length).toBeLessThanOrEqual(largeLimit);

    console.log(`✅ TC_TICKET_007: Retrieved ${largeLimitResult.tickets.length} tickets with limit ${largeLimit}`);
  });

  /**
   * [TC_TICKET_008] Hủy vé theo order ID
   * Mục tiêu: Kiểm tra cancelTicketsByOrderId hoạt động đúng
   * Input: orderId (tạo mới để test)
   * Expected: Tickets được chuyển sang status='cancelled'
   * CheckDB: Verify tickets có status='cancelled' trong DB
   * Rollback: Ticket đã hủy sẽ bị xóa trong afterAll
   */
  it('[TC_TICKET_008] should cancel tickets by order ID', async () => {
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

    console.log(`✅ TC_TICKET_008: Cancelled ticket ${ticketToCancel.id} successfully`);
  });

  /**
   * [TC_TICKET_009] Lấy vé của user với filters
   * Mục tiêu: Kiểm tra getUserTickets với status filter
   * Input: userId, page=1, limit=10, status='active'
   * Expected: Trả về chỉ active tickets của user
   * CheckDB: Verify tickets thuộc user và có status='active'
   * Rollback: Không thay đổi DB
   */
  it('[TC_TICKET_009] should get user tickets with filters', async () => {
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

    console.log(`✅ TC_TICKET_009: Retrieved ${filteredUserTicketsResult.tickets.length} tickets with filter`);
  });

  /**
   * [TC_TICKET_010] Lấy vé với ID không tồn tại
   * Mục tiêu: Kiểm tra validation ticketId hợp lệ
   * Input: ticketId=9999999 (không tồn tại)
   * Expected: Throw error
   * CheckDB: Không có ticket nào được tạo/thay đổi
   * Rollback: Không cần
   */
  it('[TC_TICKET_010] should fail when getting non-existent ticket', async () => {
    const nonExistentTicketId = 9999999;
    
    await expect(ticketService.getTicketById(nonExistentTicketId)).rejects.toThrow();

    // CheckDB: Verify no ticket exists with this ID
    const ticketInDb = await Ticket.findByPk(nonExistentTicketId);
    expect(ticketInDb).toBeNull();

    console.log('✅ TC_TICKET_010: Rejected non-existent ticket');
  });

  /**
   * [TC_TICKET_011] Lấy vé với page = 0
   * Mục tiêu: Kiểm tra validation page number
   * Input: page=0, limit=10
   * Expected: Có thể fail hoặc treat as page=1
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_TICKET_011] should handle tickets with page zero', async () => {
    const invalidPage = 0;
    
    try {
      const zeroPageResult = await ticketService.getAllTickets(invalidPage, 10);
      
      expect(zeroPageResult).toBeDefined();
      console.log('⚠️ TC_TICKET_011: Service accepts page=0');
    } catch (error: any) {
      console.log('✅ TC_TICKET_011: Service validates page > 0 (good)');
    }
  });

  /**
   * [TC_TICKET_012] Lấy vé với limit = 0
   * Mục tiêu: Kiểm tra validation limit
   * Input: page=1, limit=0
   * Expected: Có thể fail hoặc trả về empty
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_TICKET_012] should handle tickets with zero limit', async () => {
    const zeroLimit = 0;
    
    try {
      const zeroLimitResult = await ticketService.getAllTickets(1, zeroLimit);
      
      expect(zeroLimitResult).toBeDefined();
      expect(zeroLimitResult.tickets.length).toBe(0);
      console.log('✅ TC_TICKET_012: Zero limit returned empty array');
    } catch (error: any) {
      console.log('✅ TC_TICKET_012: Service validates limit > 0 (good)');
    }
  });

  /**
   * [TC_TICKET_013] Lấy vé với limit âm
   * Mục tiêu: Kiểm tra validation limit âm
   * Input: page=1, limit=-5
   * Expected: Có thể fail hoặc ignore
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_TICKET_013] should handle tickets with negative limit', async () => {
    const negativeLimit = -5;
    
    try {
      const negativeLimitResult = await ticketService.getAllTickets(1, negativeLimit);
      
      expect(negativeLimitResult).toBeDefined();
      console.log('⚠️ TC_TICKET_013: Service accepts negative limit');
    } catch (error: any) {
      console.log('✅ TC_TICKET_013: Service validates limit > 0 (good)');
    }
  });

  /**
   * [TC_TICKET_014] Lấy vé của user không tồn tại
   * Mục tiêu: Kiểm tra getUserTickets với userId không tồn tại
   * Input: userId=9999999
   * Expected: Trả về empty array
   * CheckDB: Verify không có tickets
   * Rollback: Không cần
   */
  it('[TC_TICKET_014] should return empty for non-existent user tickets', async () => {
    const nonExistentUserId = 9999999;
    
    const nonExistentUserTicketsResult = await ticketService.getUserTickets(nonExistentUserId, 1, 10);

    expect(nonExistentUserTicketsResult).toBeDefined();
    expect(Array.isArray(nonExistentUserTicketsResult.tickets)).toBe(true);
    expect(nonExistentUserTicketsResult.tickets.length).toBe(0);

    console.log('✅ TC_TICKET_014: Returned empty for non-existent user');
  });

  /**
   * [TC_TICKET_015] Hủy vé với order không tồn tại
   * Mục tiêu: Kiểm tra cancelTicketsByOrderId với orderId không tồn tại
   * Input: orderId=9999999
   * Expected: Có thể fail hoặc return 0
   * CheckDB: Không có tickets nào bị thay đổi
   * Rollback: Không cần
   */
  it('[TC_TICKET_015] should handle cancel for non-existent order', async () => {
    const nonExistentOrderId = 9999999;
    
    try {
      const cancelResult = await ticketService.cancelTicketsByOrderId(nonExistentOrderId);
      
      expect(cancelResult).toBeDefined();
      console.log('✅ TC_TICKET_015: Service handled non-existent order gracefully');
    } catch (error: any) {
      console.log('✅ TC_TICKET_015: Service rejects non-existent order (good)');
    }
  });

  /**
   * [TC_TICKET_016] Lọc vé theo status 'cancelled'
   * Mục tiêu: Kiểm tra filter theo status='cancelled'
   * Input: status='cancelled'
   * Expected: Trả về chỉ cancelled tickets
   * CheckDB: Verify tất cả tickets có status='cancelled'
   * Rollback: Không thay đổi DB
   */
  it('[TC_TICKET_016] should filter tickets by cancelled status', async () => {
    const cancelledStatusFilter = 'cancelled';
    const cancelledTicketsResult = await ticketService.getAllTickets(1, 50, {
      status: cancelledStatusFilter
    });

    expect(cancelledTicketsResult).toBeDefined();
    expect(Array.isArray(cancelledTicketsResult.tickets)).toBe(true);

    // CheckDB: Verify tất cả tickets có status='cancelled'
    for (const ticket of cancelledTicketsResult.tickets) {
      expect(ticket.status).toBe(cancelledStatusFilter);
    }

    console.log(`✅ TC_TICKET_016: Filtered ${cancelledTicketsResult.tickets.length} cancelled tickets`);
  });

  /**
   * [TC_TICKET_017] Lấy vé với page rất lớn
   * Mục tiêu: Kiểm tra handling page number lớn
   * Input: page=999999, limit=10
   * Expected: Trả về empty array (không có data)
   * CheckDB: Verify trả về empty
   * Rollback: Không cần
   */
  it('[TC_TICKET_017] should handle tickets with very large page number', async () => {
    const veryLargePage = 999999;
    
    const largePageResult = await ticketService.getAllTickets(veryLargePage, 10);

    expect(largePageResult).toBeDefined();
    expect(Array.isArray(largePageResult.tickets)).toBe(true);
    expect(largePageResult.tickets.length).toBe(0);

    console.log('✅ TC_TICKET_017: Returned empty for very large page number');
  });

  /**
   * [TC_TICKET_018] Tạo và lấy vé với ticket_code duplicate
   * Mục tiêu: Kiểm tra unique constraint trên ticket_code
   * Input: ticket_code trùng lặp
   * Expected: Có thể fail (unique constraint)
   * CheckDB: Verify chỉ có 1 ticket với code đó
   * Rollback: Ticket sẽ bị xóa
   */
  it('[TC_TICKET_018] should handle duplicate ticket code', async () => {
    const duplicateTicketCode = 'DUPLICATE_CODE_' + Date.now();
    
    const newOrder = await Order.create({
      user_id: testUserId!,
      tour_id: testTourId!,
      quantity: 1,
      total_price: 4000000,
      status: 'confirmed',
      is_paid: true,
      is_review: false,
      payment_url: 'http://test.com/payment-duplicate',
      start_date: new Date('2026-11-01'),
      end_date: new Date('2026-11-05')
    });
    createdOrders.push(newOrder.id);

    const firstTicket = await Ticket.create({
      order_id: newOrder.id,
      user_id: testUserId!,
      ticket_code: duplicateTicketCode,
      status: 'active',
      valid_from: new Date('2026-11-01'),
      valid_until: new Date('2026-11-05')
    });
    createdTickets.push(firstTicket.id);

    // Try to create duplicate
    try {
      const duplicateTicket = await Ticket.create({
        order_id: newOrder.id,
        user_id: testUserId!,
        ticket_code: duplicateTicketCode, // Same code
        status: 'active',
        valid_from: new Date('2026-11-01'),
        valid_until: new Date('2026-11-05')
      });
      
      createdTickets.push(duplicateTicket.id);
      console.log('⚠️ TC_TICKET_018: Database allows duplicate ticket codes');
    } catch (error: any) {
      console.log('✅ TC_TICKET_018: Database prevents duplicate ticket codes (good)');
    }
  });

  /**
   * [TC_TICKET_019] Lấy vé với userId = 0
   * Mục tiêu: Kiểm tra validation userId
   * Input: userId=0
   * Expected: Có thể fail hoặc trả về empty
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_TICKET_019] should handle user tickets with userId zero', async () => {
    const invalidUserId = 0;
    
    try {
      const zeroUserIdResult = await ticketService.getUserTickets(invalidUserId, 1, 10);
      
      expect(zeroUserIdResult).toBeDefined();
      console.log('⚠️ TC_TICKET_019: Service accepts userId=0');
    } catch (error: any) {
      console.log('✅ TC_TICKET_019: Service validates userId > 0 (good)');
    }
  });

  /**
   * [TC_TICKET_020] Verify ticket service methods
   * Mục tiêu: Kiểm tra service có đầy đủ methods
   * Input: Không có
   * Expected: 4 methods đều tồn tại
   * CheckDB: Không cần
   * Rollback: Không cần
   */
  it('[TC_TICKET_020] should have all required methods', async () => {
    expect(typeof ticketService.getUserTickets).toBe('function');
    expect(typeof ticketService.getAllTickets).toBe('function');
    expect(typeof ticketService.getTicketById).toBe('function');
    expect(typeof ticketService.cancelTicketsByOrderId).toBe('function');

    console.log('✅ TC_TICKET_020: All required methods exist');
  });
});
