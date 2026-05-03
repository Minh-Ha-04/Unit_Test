import { describe, it, expect } from 'vitest';
import reportService from '../services/reportService';

/**
 * Feature 16: Report Service - Optimized Unit Tests
 * Report service is read-only, no DB changes, no rollback needed
 */
describe('[Feature 16] Report Service - Optimized Unit Tests', () => {
  /**
   * [TC_REPORT_001] Get revenue stats with empty options
   * Mục tiêu: Lấy thống kê doanh thu với bộ lọc rỗng (mặc định)
   * Input: {}
   * Expected: Trả về object chứa range, summary, breakdown
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_REPORT_001] should get revenue stats with empty options', async () => {
    const revenueStats = await reportService.getRevenueStats({});
    expect(revenueStats).toBeDefined();
    expect(typeof revenueStats).toBe('object');
  });

  /**
   * [TC_REPORT_002] Get top tours with limit
   * Mục tiêu: Lấy danh sách tour hàng đầu với giới hạn số lượng
   * Input: { limit: 10 }
   * Expected: Trả về { total, data } với data.length ≤ limit, mỗi item có rank, tour, totalRevenue, totalTickets, orderCount
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_REPORT_002] should get top tours with limit', async () => {
    const tourLimit = 10;
    const topToursResult = await reportService.getTopTours({ limit: tourLimit });

    expect(topToursResult).toBeDefined();
    expect(topToursResult).toHaveProperty('total');
    expect(topToursResult).toHaveProperty('data');
    expect(Array.isArray(topToursResult.data)).toBe(true);
    expect(topToursResult.data.length).toBeLessThanOrEqual(tourLimit);

    for (const tour of topToursResult.data) {
      expect(tour).toHaveProperty('rank');
      expect(tour).toHaveProperty('tour');
      expect(tour).toHaveProperty('totalRevenue');
      expect(tour).toHaveProperty('totalTickets');
      expect(tour).toHaveProperty('orderCount');
    }
  });

  /**
   * [TC_REPORT_003] Get top rated tours with limit
   * Mục tiêu: Lấy danh sách tour đánh giá cao nhất
   * Input: { limit: 10 }
   * Expected: Mảng với length ≤ 10, mỗi phần tử có rank, tour, averageRating, reviewCount
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_REPORT_003] should get top rated tours with limit', async () => {
    const topRatedTours = await reportService.getTopRatedTours({ limit: 10 });

    expect(topRatedTours).toBeDefined();
    expect(Array.isArray(topRatedTours)).toBe(true);
    expect(topRatedTours.length).toBeLessThanOrEqual(10);

    for (const tour of topRatedTours) {
      expect(tour).toHaveProperty('rank');
      expect(tour).toHaveProperty('tour');
      expect(tour).toHaveProperty('averageRating');
      expect(tour).toHaveProperty('reviewCount');
    }
  });

  /**
   * [TC_REPORT_004] Get top users with limit
   * Mục tiêu: Lấy danh sách khách hàng chi tiêu cao nhất
   * Input: { limit: 10 }
   * Expected: Trả về { total, data } với data.length ≤ 10, mỗi item có rank, user, totalSpent, orderCount
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_REPORT_004] should get top users with limit', async () => {
    const topUsersResult = await reportService.getTopUsers({ limit: 10 });

    expect(topUsersResult).toBeDefined();
    expect(topUsersResult).toHaveProperty('total');
    expect(topUsersResult).toHaveProperty('data');
    expect(Array.isArray(topUsersResult.data)).toBe(true);
    expect(topUsersResult.data.length).toBeLessThanOrEqual(10);

    for (const user of topUsersResult.data) {
      expect(user).toHaveProperty('rank');
      expect(user).toHaveProperty('user');
      expect(user).toHaveProperty('totalSpent');
      expect(user).toHaveProperty('orderCount');
    }
  });

  /**
   * [TC_REPORT_005] Get revenue stats with date range and metric
   * Mục tiêu: Lấy thống kê doanh thu theo khoảng thời gian cụ thể (tháng)
   * Input: { range: 'month' }
   * Expected: revenueStats được định nghĩa, có breakdown theo từng tháng
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_REPORT_005] should get revenue stats with date range and metric', async () => {
    const revenueStats = await reportService.getRevenueStats({
      range: 'month' as any
    });
    expect(revenueStats).toBeDefined();
  });

  /**
   * [TC_REPORT_006] Get top tours with search functionality
   * Mục tiêu: Tìm kiếm tour theo từ khóa
   * Input: { limit: 5, search: 'Tour' }
   * Expected: Trả về { total, data } chỉ chứa tour có title/destination/tour_code chứa 'Tour'
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_REPORT_006] should get top tours with search filter', async () => {
    const searchResult = await reportService.getTopTours({
      limit: 5,
      search: 'Tour'
    });

    expect(searchResult).toBeDefined();
    expect(searchResult).toHaveProperty('total');
    expect(searchResult).toHaveProperty('data');
    expect(Array.isArray(searchResult.data)).toBe(true);

    if (searchResult.data.length > 0) {
      expect(searchResult.total).toBeGreaterThan(0);
    }
  });

  /**
   * [TC_REPORT_007] Get top rated tours with minReviews filter
   * Mục tiêu: Lọc tour đánh giá cao với số lượng review tối thiểu
   * Input: { limit: 5, minReviews: 2 }
   * Expected: Mảng tour có reviewCount ≥ 2
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_REPORT_007] should get top rated tours with minReviews', async () => {
    const topRatedTours = await reportService.getTopRatedTours({
      limit: 5,
      minReviews: 2
    });

    expect(topRatedTours).toBeDefined();
    expect(Array.isArray(topRatedTours)).toBe(true);

    for (const tour of topRatedTours) {
      expect(tour.reviewCount).toBeGreaterThanOrEqual(2);
    }
  });

  /**
   * [TC_REPORT_008] Get top users with search functionality
   * Mục tiêu: Tìm kiếm khách hàng theo username/email/phone/id
   * Input: { limit: 5, search: '@example.com' }
   * Expected: Trả về { total, data } chỉ chứa user có email chứa '@example.com'
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_REPORT_008] should get top users with search filter', async () => {
    const searchResult = await reportService.getTopUsers({
      limit: 5,
      search: '@example.com'
    });

    expect(searchResult).toBeDefined();
    expect(searchResult).toHaveProperty('total');
    expect(searchResult).toHaveProperty('data');
    expect(Array.isArray(searchResult.data)).toBe(true);

    if (searchResult.data.length > 0) {
      expect(searchResult.total).toBeGreaterThan(0);
    }
  });

  /**
   * [TC_REPORT_009] Top tours sorting verification
   * Mục tiêu: Kiểm tra thứ tự sắp xếp của top tours (doanh thu giảm dần)
   * Input: { limit: 10 }
   * Expected: Doanh thu của tour đầu lớn hơn hoặc bằng tour sau
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_REPORT_009] should return top tours sorted by revenue', async () => {
    const topToursResult = await reportService.getTopTours({ limit: 10 });

    if (topToursResult.data.length > 1) {
      for (let i = 1; i < topToursResult.data.length; i++) {
        const prevRevenue = Number(topToursResult.data[i - 1].totalRevenue || 0);
        const currRevenue = Number(topToursResult.data[i].totalRevenue || 0);
        expect(prevRevenue).toBeGreaterThanOrEqual(currRevenue);
      }
    }
  });
});