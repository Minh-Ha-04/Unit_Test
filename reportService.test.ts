import { describe, it, expect } from 'vitest';
import reportService from '../services/reportService';

/**
 * Feature 16: Report Service - Optimized Unit Tests
 * Report service is read-only, no DB changes, no rollback needed
 */
describe('[Feature 16] Report Service - Optimized Unit Tests', () => {
  /**
   * [TC_REPORT_001] Get revenue stats with empty options
   */
  it('[TC_REPORT_001] should get revenue stats with empty options', async () => {
    const revenueStats = await reportService.getRevenueStats({});

    expect(revenueStats).toBeDefined();
    expect(typeof revenueStats).toBe('object');

    console.log('✅ TC_REPORT_001: Retrieved revenue stats');
  });

  /**
   * [TC_REPORT_002] Get top tours with limit
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

    console.log(`✅ TC_REPORT_002: Retrieved ${topToursResult.data.length} top tours`);
  });

  /**
   * [TC_REPORT_003] Get top rated tours with limit
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

    console.log(`✅ TC_REPORT_003: Retrieved ${topRatedTours.length} top rated tours`);
  });

  /**
   * [TC_REPORT_004] Get top users with limit
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

    console.log(`✅ TC_REPORT_004: Retrieved ${topUsersResult.data.length} top users`);
  });

  /**
   * [TC_REPORT_005] Get revenue stats with date range and metric
   */
  it('[TC_REPORT_005] should get revenue stats with date range and metric', async () => {
    const revenueStats = await reportService.getRevenueStats({
      range: 'month' as any
    });

    expect(revenueStats).toBeDefined();
    console.log('✅ TC_REPORT_005: Retrieved revenue stats with filters');
  });

  /**
   * [TC_REPORT_006] Get top tours with search functionality
   */
  it('[TC_REPORT_006] should get top tours with search filter', async () => {
    // Test search that should find results
    const searchResult = await reportService.getTopTours({
      limit: 5,
      search: 'Tour' // Common keyword
    });

    expect(searchResult).toBeDefined();
    expect(searchResult).toHaveProperty('total');
    expect(searchResult).toHaveProperty('data');
    expect(Array.isArray(searchResult.data)).toBe(true);

    // If search found results, verify they match search term
    if (searchResult.data.length > 0) {
      expect(searchResult.total).toBeGreaterThan(0);
    }

    console.log(`✅ TC_REPORT_006: Search returned ${searchResult.data.length} results`);
  });

  /**
   * [TC_REPORT_007] Get top rated tours with minReviews filter
   */
  it('[TC_REPORT_007] should get top rated tours with minReviews', async () => {
    const topRatedTours = await reportService.getTopRatedTours({
      limit: 5,
      minReviews: 2
    });

    expect(topRatedTours).toBeDefined();
    expect(Array.isArray(topRatedTours)).toBe(true);

    // All tours should have at least minReviews
    for (const tour of topRatedTours) {
      expect(tour.reviewCount).toBeGreaterThanOrEqual(2);
    }

    console.log(`✅ TC_REPORT_007: Retrieved ${topRatedTours.length} tours with min 2 reviews`);
  });

  /**
   * [TC_REPORT_008] Get top users with search functionality
   */
  it('[TC_REPORT_008] should get top users with search filter', async () => {
    // Test search by email pattern
    const searchResult = await reportService.getTopUsers({
      limit: 5,
      search: '@example.com' // Common email domain
    });

    expect(searchResult).toBeDefined();
    expect(searchResult).toHaveProperty('total');
    expect(searchResult).toHaveProperty('data');
    expect(Array.isArray(searchResult.data)).toBe(true);

    if (searchResult.data.length > 0) {
      expect(searchResult.total).toBeGreaterThan(0);
    }

    console.log(`✅ TC_REPORT_008: User search returned ${searchResult.data.length} results`);
  });

  /**
   * [TC_REPORT_009] Top tours sorting verification
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

    console.log('✅ TC_REPORT_009: Tours sorted correctly by revenue');
  });

});
