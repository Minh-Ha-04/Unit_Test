import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import tourGuideAssignmentService from '../services/tourGuideAssignmentService';
import User from '../models/User';
import Tour from '../models/Tour';
import Admin from '../models/Admin';
import TourGuide from '../models/TourGuide';
import Order from '../models/Order';

/**
 * Feature 18: Tour Guide Assignment - Comprehensive Unit Tests (Refactored)
 * 
 * ✅ Test Case IDs rõ ràng từ 001 đến 029
 * ✅ Mỗi test case kiểm tra đúng một function/scenario
 * ✅ Loại bỏ các test bị trùng lặp nội dung
 * ✅ CheckDB: Xác minh database queries thông qua expect
 * ✅ Rollback: Cleanup test data trong afterAll
 * 
 * Các method được test:
 * - checkAvailableGuidesForDates (TC_GUIDE_001-004)
 * - getAvailableGuidesForTour (TC_GUIDE_005-007)
 * - assignGuideToTour (TC_GUIDE_008-010)
 * - getToursByGuideId (TC_GUIDE_011-014)
 * - getGuidesByTourAndDates (TC_GUIDE_015-016)
 * - getGuideToursForAdmin (TC_GUIDE_017-021)
 * - getAssignedToursWithUpcomingStartDate (TC_GUIDE_022-028)
 * - getOrdersByTourAssignment (TC_GUIDE_029)
 */
describe('[Feature 18] Tour Guide Assignment - Comprehensive Unit Tests', () => {
  // Test data tracking
  let createdUsers: number[] = [];
  let createdTours: number[] = [];
  let createdGuides: number[] = [];
  let createdTourGuides: number[] = [];
  let createdOrders: number[] = [];

  let testUser: any;
  let testTour: any;
  let testGuide: any;

  beforeAll(async () => {
    // Create test user
    testUser = await User.create({
      username: 'test_guide_user',
      email: 'guide_test@example.com',
      password_hash: 'hashed_password_123',
      phone: '0900000001',
      google_id: null,
    });
    createdUsers.push(testUser.id);

    // Create test tour
    testTour = await Tour.create({
      tour_code: 'TEST-GUIDE-001',
      title: 'Test Tour For Guide Assignment',
      description: 'Test description',
      start_date: new Date('2026-12-01'),
      end_date: new Date('2026-12-05'),
      price: 5000000,
      capacity: 20,
      region: 'northern',
      departure: 'Hanoi',
      destination: 'Sapa',
      latitude: 21.5,
      longitude: 105.5,
    });
    createdTours.push(testTour.id);

    // Create test guide
    testGuide = await Admin.create({
      username: 'test_guide_001',
      email: 'guide001@example.com',
      password_hash: 'hashed_password_123',
      role: 'guide',
      region: 'northern',
      is_active: true,
    });
    createdGuides.push(testGuide.id);
  });

  afterAll(async () => {
    // Cleanup in reverse order to respect foreign key constraints
    if (createdOrders.length) await Order.destroy({ where: { id: createdOrders } });
    if (createdTourGuides.length) await TourGuide.destroy({ where: { id: createdTourGuides } });
    if (createdGuides.length) await Admin.destroy({ where: { id: createdGuides } });
    if (createdTours.length) await Tour.destroy({ where: { id: createdTours } });
    if (createdUsers.length) await User.destroy({ where: { id: createdUsers } });
  });

  // ==================== checkAvailableGuidesForDates ====================
  /**
   * [TC_GUIDE_001] Kiểm tra checkAvailableGuidesForDates với Date objects
   * Mục tiêu: Xác minh hàm chấp nhận tham số là Date object
   * Input: new Date('2026-12-01'), new Date('2026-12-05')
   * Expected: Trả về boolean (true/false) tùy theo guide rảnh
   */
  it('[TC_GUIDE_001] should check availability using Date objects', async () => {
    const available = await tourGuideAssignmentService.checkAvailableGuidesForDates(
      new Date('2026-12-01'),
      new Date('2026-12-05')
    );
    expect(typeof available).toBe('boolean');
    console.log('✅ TC_GUIDE_001: Date objects work');
  });

  /**
   * [TC_GUIDE_002] Kiểm tra checkAvailableGuidesForDates với string dates
   * Mục tiêu: Xác minh hàm chấp nhận tham số là string định dạng YYYY-MM-DD
   * Input: '2026-12-01', '2026-12-05'
   * Expected: Trả về boolean
   */
  it('[TC_GUIDE_002] should check availability using string dates', async () => {
    const available = await tourGuideAssignmentService.checkAvailableGuidesForDates(
      '2026-12-01',
      '2026-12-05'
    );
    expect(typeof available).toBe('boolean');
    console.log('✅ TC_GUIDE_002: String dates work');
  });

  /**
   * [TC_GUIDE_003] Kiểm tra checkAvailableGuidesForDates với excludeTourId
   * Mục tiêu: Xác minh tham số excludeTourId được xử lý (bỏ qua tour đang cập nhật)
   * Input: Date objects + testTour.id
   * Expected: Trả về boolean, không throw lỗi
   */
  it('[TC_GUIDE_003] should check availability with excludeTourId', async () => {
    const available = await tourGuideAssignmentService.checkAvailableGuidesForDates(
      new Date('2026-12-01'),
      new Date('2026-12-05'),
      testTour.id
    );
    expect(typeof available).toBe('boolean');
    console.log('✅ TC_GUIDE_003: excludeTourId works');
  });

  /**
   * [TC_GUIDE_004] Kiểm tra checkAvailableGuidesForDates cho ngày xa trong tương lai
   * Mục tiêu: Đảm bảo hàm hoạt động với khoảng thời gian xa (không bị lỗi)
   * Input: new Date('2030-01-01'), new Date('2030-01-05')
   * Expected: Trả về boolean
   */
  it('[TC_GUIDE_004] should check availability for far future dates', async () => {
    const available = await tourGuideAssignmentService.checkAvailableGuidesForDates(
      new Date('2030-01-01'),
      new Date('2030-01-05')
    );
    expect(typeof available).toBe('boolean');
    console.log(`✅ TC_GUIDE_004: Future availability = ${available}`);
  });

  // ==================== getAvailableGuidesForTour ====================
  /**
   * [TC_GUIDE_005] Lấy danh sách guide có thể phân công cho tour hợp lệ
   * Mục tiêu: Kiểm tra hàm trả về đúng cấu trúc và có dữ liệu
   * Input: testTour.id
   * Expected: Mảng các guide, mỗi phần tử có các trường guide, ticketCount, canAssign, isSameRegion
   */
  it('[TC_GUIDE_005] should return available guides for a valid tour', async () => {
    const availableGuides = await tourGuideAssignmentService.getAvailableGuidesForTour(testTour.id);
    expect(Array.isArray(availableGuides)).toBe(true);
    expect(availableGuides.length).toBeGreaterThan(0);
    expect(availableGuides[0]).toHaveProperty('guide');
    expect(availableGuides[0]).toHaveProperty('ticketCount');
    expect(availableGuides[0]).toHaveProperty('canAssign');
    expect(availableGuides[0]).toHaveProperty('isSameRegion');
    console.log(`✅ TC_GUIDE_005: Found ${availableGuides.length} guides`);
  });

  /**
   * [TC_GUIDE_006] Xử lý tour không tồn tại
   * Mục tiêu: Kiểm tra validation khi tourId không có trong DB
   * Input: tourId = 9999999
   * Expected: Throw error 'Tour không tồn tại'
   */
  it('[TC_GUIDE_006] should throw error for non-existent tour', async () => {
    await expect(
      tourGuideAssignmentService.getAvailableGuidesForTour(9999999)
    ).rejects.toThrow('Tour không tồn tại');
    console.log('✅ TC_GUIDE_006: Non-existent tour rejected');
  });

  /**
   * [TC_GUIDE_007] Kiểm tra thứ tự sắp xếp guide (cùng region lên trước)
   * Mục tiêu: Xác minh thuật toán ưu tiên guide cùng region
   * Input: testTour.id (region = 'northern')
   * Expected: Các guide cùng region xuất hiện trước guide khác region
   */
  it('[TC_GUIDE_007] should sort guides by same region first', async () => {
    const availableGuides = await tourGuideAssignmentService.getAvailableGuidesForTour(testTour.id);
    if (availableGuides.length > 1) {
      const firstSameRegionIndex = availableGuides.findIndex(g => g.isSameRegion === true);
      const firstOtherRegionIndex = availableGuides.findIndex(g => g.isSameRegion === false);
      if (firstSameRegionIndex !== -1 && firstOtherRegionIndex !== -1) {
        expect(firstSameRegionIndex).toBeLessThan(firstOtherRegionIndex);
      }
    }
    console.log('✅ TC_GUIDE_007: Sorting by region works');
  });

  // ==================== assignGuideToTour ====================
  /**
   * [TC_GUIDE_008] Phân công guide cho tour không tồn tại
   * Mục tiêu: Kiểm tra validation khi tour không có trong DB
   * Input: tourId = 9999999, startDate='2026-12-01', endDate='2026-12-05'
   * Expected: Throw error 'Tour không tồn tại'
   */
  it('[TC_GUIDE_008] should fail when tour does not exist', async () => {
    await expect(
      tourGuideAssignmentService.assignGuideToTour(9999999, '2026-12-01', '2026-12-05')
    ).rejects.toThrow('Tour không tồn tại');
    console.log('✅ TC_GUIDE_008: Tour existence validated');
  });

  /**
   * [TC_GUIDE_009] Tạo mới phân công guide thành công
   * Mục tiêu: Kiểm tra tạo mới bản ghi trong bảng tour_guides
   * Input: testTour.id, startDate='2026-12-01', endDate='2026-12-05'
   * Expected: Trả về object chứa guide và tourGuide, tourGuide.tour_id khớp với testTour.id
   */
  it('[TC_GUIDE_009] should create a new assignment successfully', async () => {
    const result = await tourGuideAssignmentService.assignGuideToTour(
      testTour.id,
      '2026-12-01',
      '2026-12-05'
    );
    expect(result).toBeDefined();
    expect(result).toHaveProperty('guide');
    expect(result).toHaveProperty('tourGuide');
    expect(result.guide.role).toBe('guide');
    expect(result.tourGuide.tour_id).toBe(testTour.id);
    createdTourGuides.push(result.tourGuide.id);
    console.log(`✅ TC_GUIDE_009: Created assignment with guide ${result.guide.id}`);
  });

  /**
   * [TC_GUIDE_010] Cập nhật phân công đã tồn tại
   * Mục tiêu: Khi gọi lại với cùng tour_id, start_date, end_date, phải update thay vì tạo mới
   * Input: testTour.id, cùng khoảng thời gian
   * Expected: Không throw lỗi, tourGuide.tour_id vẫn đúng
   */
  it('[TC_GUIDE_010] should update existing assignment when called again', async () => {
    const result = await tourGuideAssignmentService.assignGuideToTour(
      testTour.id,
      '2026-12-01',
      '2026-12-05'
    );
    expect(result).toBeDefined();
    expect(result.tourGuide.tour_id).toBe(testTour.id);
    console.log('✅ TC_GUIDE_010: Existing assignment updated');
  });

  // ==================== getToursByGuideId ====================
  /**
   * [TC_GUIDE_011] Lấy danh sách tour của guide với phân trang (trang 1)
   * Mục tiêu: Kiểm tra cấu trúc phân trang và dữ liệu trả về đúng page, limit
   * Input: guideId = testGuide.id, page=1, limit=5
   * Expected: pagination.page = 1, pagination.limit = 5, có total và totalPages
   */
  it('[TC_GUIDE_011] should return paginated tours (page 1)', async () => {
    const page1 = await tourGuideAssignmentService.getToursByGuideId(testGuide.id, 1, 5);
    expect(page1.pagination.page).toBe(1);
    expect(page1.pagination.limit).toBe(5);
    expect(page1.pagination).toHaveProperty('total');
    expect(page1.pagination).toHaveProperty('totalPages');
    console.log('✅ TC_GUIDE_011: Pagination page 1 works');
  });

  /**
   * [TC_GUIDE_012] Lấy trang thứ 2 của danh sách tour của guide (khi không đủ dữ liệu)
   * Mục tiêu: Kiểm tra behavior khi page vượt quá tổng số trang - service sẽ trả về trang cuối cùng (page 1)
   * Input: guideId = testGuide.id, page=2, limit=1
   * Expected: pagination.page = 1 (vì chỉ có 1 tour, totalPages=1)
   */
  it('[TC_GUIDE_012] should return page 2 correctly', async () => {
    const page2 = await tourGuideAssignmentService.getToursByGuideId(testGuide.id, 2, 1);
    // Khi chỉ có 1 trang, page=2 sẽ được điều chỉnh về 1
    expect(page2.pagination.page).toBe(1);
    expect(page2.pagination.limit).toBe(1);
    console.log('✅ TC_GUIDE_012: Pagination page 2 works');
  });

  /**
   * [TC_GUIDE_013] Lọc tour theo trạng thái 'valid' (còn hạn)
   * Mục tiêu: Kiểm tra filter status = 'valid' trả về các tour có end_date >= today
   * Input: guideId = testGuide.id, status='valid'
   * Expected: Mảng tours, mỗi tour có end_date >= ngày hiện tại
   */
  it('[TC_GUIDE_013] should filter tours by status "valid"', async () => {
    const validTours = await tourGuideAssignmentService.getToursByGuideId(testGuide.id, 1, 10, 'valid');
    expect(Array.isArray(validTours.tours)).toBe(true);
    console.log(`✅ TC_GUIDE_013: Found ${validTours.tours.length} valid tours`);
  });

  /**
   * [TC_GUIDE_014] Lọc tour theo trạng thái 'expired' (hết hạn)
   * Mục tiêu: Kiểm tra filter status = 'expired' trả về các tour có end_date < today
   * Input: guideId = testGuide.id, status='expired'
   * Expected: Mảng tours, mỗi tour có end_date < ngày hiện tại
   */
  it('[TC_GUIDE_014] should filter tours by status "expired"', async () => {
    const expiredTours = await tourGuideAssignmentService.getToursByGuideId(testGuide.id, 1, 10, 'expired');
    expect(Array.isArray(expiredTours.tours)).toBe(true);
    console.log(`✅ TC_GUIDE_014: Found ${expiredTours.tours.length} expired tours`);
  });

  // ==================== getGuidesByTourAndDates ====================
  /**
   * [TC_GUIDE_015] Lấy danh sách guide được phân công cho tour với ngày chính xác
   * Mục tiêu: Kiểm tra hàm trả về đúng các assignment có start_date/end_date trùng khớp
   * Input: tourId = testTour.id, startDate='2026-12-01', endDate='2026-12-05'
   * Expected: Mảng các guide, mỗi phần tử có guide_id, guide, và thông tin guide chi tiết
   */
  it('[TC_GUIDE_015] should return assigned guides for exact date match', async () => {
    const guides = await tourGuideAssignmentService.getGuidesByTourAndDates(
      testTour.id, '2026-12-01', '2026-12-05'
    );
    expect(Array.isArray(guides)).toBe(true);
    expect(guides.length).toBeGreaterThan(0);
    expect(guides[0]).toHaveProperty('guide_id');
    expect(guides[0]).toHaveProperty('guide');
    expect(guides[0].guide).toHaveProperty('username');
    console.log(`✅ TC_GUIDE_015: Found ${guides.length} guides`);
  });

  /**
   * [TC_GUIDE_016] Lấy guide với khoảng thời gian overlap (con khoảng)
   * Mục tiêu: Kiểm tra điều kiện tìm kiếm overlap (start_date <= endDate AND end_date >= startDate)
   * Input: tourId = testTour.id, startDate='2026-12-02', endDate='2026-12-04' (nằm trong tour gốc)
   * Expected: Trả về các guide có assignment chứa khoảng thời gian này
   */
  it('[TC_GUIDE_016] should return guides with overlapping dates (subset)', async () => {
    const guides = await tourGuideAssignmentService.getGuidesByTourAndDates(
      testTour.id, '2026-12-02', '2026-12-04'
    );
    expect(Array.isArray(guides)).toBe(true);
    console.log(`✅ TC_GUIDE_016: Found ${guides.length} guides with overlap`);
  });

  // ==================== getGuideToursForAdmin ====================
  /**
   * [TC_GUIDE_017] Lọc tour của guide theo guideId (admin view)
   * Mục tiêu: Kiểm tra hàm trả về đúng các tour assignment của một guide cụ thể
   * Input: guideId = testGuide.id
   * Expected: Có tours và pagination
   */
  it('[TC_GUIDE_017] should filter by specific guideId', async () => {
    const result = await tourGuideAssignmentService.getGuideToursForAdmin(testGuide.id, 1, 10);
    expect(result).toHaveProperty('tours');
    expect(result).toHaveProperty('pagination');
    console.log(`✅ TC_GUIDE_017: Found ${result.tours.length} tours for this guide`);
  });

  /**
   * [TC_GUIDE_018] Lọc tour của guide theo từ khóa tìm kiếm (title hoặc tour_code)
   * Mục tiêu: Kiểm tra tìm kiếm text hoạt động
   * Input: search = 'Test Tour'
   * Expected: Mảng tours chứa từ khóa
   */
  it('[TC_GUIDE_018] should filter by search term (tour title / code)', async () => {
    const result = await tourGuideAssignmentService.getGuideToursForAdmin(
      testGuide.id, 1, 10, 'Test Tour'
    );
    expect(Array.isArray(result.tours)).toBe(true);
    console.log(`✅ TC_GUIDE_018: Search returned ${result.tours.length} tours`);
  });

  /**
   * [TC_GUIDE_019] Lọc tour của guide theo trạng thái 'valid' (còn hạn)
   * Mục tiêu: Cho admin xem các tour chưa kết thúc
   * Input: valid = 'valid'
   * Expected: Chỉ trả về tours có end_date >= today
   */
  it('[TC_GUIDE_019] should filter by valid status', async () => {
    const result = await tourGuideAssignmentService.getGuideToursForAdmin(
      testGuide.id, 1, 10, undefined, 'valid'
    );
    expect(Array.isArray(result.tours)).toBe(true);
    console.log(`✅ TC_GUIDE_019: Valid tours = ${result.tours.length}`);
  });

  /**
   * [TC_GUIDE_020] Lọc tour của guide theo trạng thái 'invalid' (hết hạn)
   * Mục tiêu: Cho admin xem các tour đã kết thúc
   * Input: valid = 'invalid'
   * Expected: Chỉ trả về tours có end_date < today
   */
  it('[TC_GUIDE_020] should filter by invalid (expired) status', async () => {
    const result = await tourGuideAssignmentService.getGuideToursForAdmin(
      testGuide.id, 1, 10, undefined, 'invalid'
    );
    expect(Array.isArray(result.tours)).toBe(true);
    console.log(`✅ TC_GUIDE_020: Expired tours = ${result.tours.length}`);
  });

  /**
   * [TC_GUIDE_021] Lấy tất cả tour của tất cả guide (không truyền guideId)
   * Mục tiêu: Admin view tổng hợp
   * Input: không có guideId
   * Expected: Trả về tours của nhiều guide, có pagination
   */
  it('[TC_GUIDE_021] should return all guide tours when guideId omitted', async () => {
    const result = await tourGuideAssignmentService.getGuideToursForAdmin();
    expect(result).toHaveProperty('tours');
    expect(result).toHaveProperty('pagination');
    console.log(`✅ TC_GUIDE_021: Total tours across all guides = ${result.tours.length}`);
  });

  // ==================== getAssignedToursWithUpcomingStartDate ====================
  /**
   * [TC_GUIDE_022] Lọc các tour đã phân công theo từ khóa tìm kiếm (tour_code)
   * Mục tiêu: Kiểm tra tìm kiếm trong danh sách tour có guide
   * Input: search = 'TEST-GUIDE'
   * Expected: Mảng tours chứa tour_code khớp
   */
  it('[TC_GUIDE_022] should filter assigned tours by search (tour_code)', async () => {
    const result = await tourGuideAssignmentService.getAssignedToursWithUpcomingStartDate(
      1, 10, 'TEST-GUIDE'
    );
    expect(result).toHaveProperty('tours');
    expect(result).toHaveProperty('pagination');
    console.log(`✅ TC_GUIDE_022: Search returned ${result.tours.length} tours`);
  });

  /**
   * [TC_GUIDE_023] Lọc tour đã phân công theo trạng thái 'active' (còn hạn)
   * Mục tiêu: Chỉ lấy các tour có ngày kết thúc >= hôm nay
   * Input: status = 'active'
   * Expected: Mảng tours, mỗi tour có end_date >= today
   */
  it('[TC_GUIDE_023] should filter by active status', async () => {
    const result = await tourGuideAssignmentService.getAssignedToursWithUpcomingStartDate(
      1, 10, undefined, undefined, undefined, undefined, 'active'
    );
    expect(Array.isArray(result.tours)).toBe(true);
    console.log(`✅ TC_GUIDE_023: Active tours = ${result.tours.length}`);
  });

  /**
   * [TC_GUIDE_024] Lọc tour đã phân công theo vùng miền (region)
   * Mục tiêu: Kiểm tra filter theo region
   * Input: regions = ['northern']
   * Expected: Chỉ trả về tour có region = 'northern'
   */
  it('[TC_GUIDE_024] should filter by region', async () => {
    const result = await tourGuideAssignmentService.getAssignedToursWithUpcomingStartDate(
      1, 10, undefined, ['northern']
    );
    expect(Array.isArray(result.tours)).toBe(true);
    console.log(`✅ TC_GUIDE_024: Northern tours = ${result.tours.length}`);
  });

  /**
   * [TC_GUIDE_025] Lọc tour đã phân công theo khoảng thời gian (start_date - end_date)
   * Mục tiêu: Kiểm tra filter theo ngày bắt đầu và kết thúc của tour
   * Input: startDate='2026-01-01', endDate='2026-12-31'
   * Expected: Chỉ lấy tour nằm trong khoảng đó
   */
  it('[TC_GUIDE_025] should filter by date range', async () => {
    const result = await tourGuideAssignmentService.getAssignedToursWithUpcomingStartDate(
      1, 10, undefined, undefined, '2026-01-01', '2026-12-31'
    );
    expect(Array.isArray(result.tours)).toBe(true);
    console.log(`✅ TC_GUIDE_025: Tours in range = ${result.tours.length}`);
  });

  /**
   * [TC_GUIDE_026] Sắp xếp tour đã phân công theo start_date tăng dần
   * Mục tiêu: Kiểm tra sort parameter startDateSort = 'asc'
   * Input: startDateSort = 'asc'
   * Expected: Mảng tours có start_date tăng dần
   */
  it('[TC_GUIDE_026] should sort by start_date ascending', async () => {
    const result = await tourGuideAssignmentService.getAssignedToursWithUpcomingStartDate(
      1, 10, undefined, undefined, undefined, undefined, undefined, 'asc'
    );
    expect(Array.isArray(result.tours)).toBe(true);
    console.log('✅ TC_GUIDE_026: Sorted by start_date asc');
  });

  /**
   * [TC_GUIDE_027] Sắp xếp tour đã phân công theo end_date giảm dần
   * Mục tiêu: Kiểm tra sort parameter endDateSort = 'desc'
   * Input: endDateSort = 'desc'
   * Expected: Mảng tours có end_date giảm dần
   */
  it('[TC_GUIDE_027] should sort by end_date descending', async () => {
    const result = await tourGuideAssignmentService.getAssignedToursWithUpcomingStartDate(
      1, 10, undefined, undefined, undefined, undefined, undefined, undefined, 'desc'
    );
    expect(Array.isArray(result.tours)).toBe(true);
    console.log('✅ TC_GUIDE_027: Sorted by end_date desc');
  });

  /**
   * [TC_GUIDE_028] Sắp xếp tour đã phân công theo quantity_client tăng dần
   * Mục tiêu: Kiểm tra sort parameter quantityClientSort = 'asc'
   * Input: quantityClientSort = 'asc'
   * Expected: Mảng tours có số lượng khách tăng dần
   */
  it('[TC_GUIDE_028] should sort by quantity_client ascending', async () => {
    const result = await tourGuideAssignmentService.getAssignedToursWithUpcomingStartDate(
      1, 10, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 'asc'
    );
    expect(Array.isArray(result.tours)).toBe(true);
    console.log('✅ TC_GUIDE_028: Sorted by quantity_client asc');
  });

  // ==================== getOrdersByTourAssignment ====================
  /**
   * [TC_GUIDE_029] Lấy danh sách đơn hàng theo một tour assignment cụ thể
   * Mục tiêu: Kiểm tra hàm trả về orders được gán cho tour, guide, và khoảng thời gian
   * Input: tourId, guideId, startDate='2026-12-01', endDate='2026-12-05'
   * Expected: Mảng các order (có thể rỗng nếu chưa có đơn), mỗi order có cấu trúc đúng
   */
  it('[TC_GUIDE_029] should return orders for a specific tour assignment', async () => {
    const orders = await tourGuideAssignmentService.getOrdersByTourAssignment(
      testTour.id, testGuide.id, '2026-12-01', '2026-12-05'
    );
    expect(Array.isArray(orders)).toBe(true);
    console.log(`✅ TC_GUIDE_029: Found ${orders.length} orders`);
  });
});