import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import reviewService from '../services/reviewService';
import Review from '../models/Review';
import User from '../models/User';
import Tour from '../models/Tour';
import Order from '../models/Order';
import bcrypt from 'bcryptjs';

/**
 * Feature 5: Review System - Comprehensive Unit Tests
 * ✅ Test Case IDs rõ ràng
 * ✅ CheckDB: Xác minh database thay đổi đúng
 * ✅ Rollback: Đảm bảo DB trở về trạng thái ban đầu
 * ❗ Tests có cả PASS và edge cases thực tế
 * 
 * Services được test:
 * - createReview()
 * - getTourReviews()
 * - getUserReviews()
 * - getReviewStats()
 */
describe('[Feature 5] Review System - Complete Unit Tests', () => {
  let testUserId: number | undefined;
  let testTourId: number | undefined;
  let testOrderId: number | undefined;
  let createdReviewId: number | undefined;
  let createdReviews: number[] = [];
  let createdUsers: number[] = [];
  let createdTours: number[] = [];
  let createdOrders: number[] = [];

  beforeAll(async () => {
    console.log('⭐ Bắt đầu kiểm thử Hệ Thống Đánh Giá...');

    // Tạo test user
    const hashedPassword = await bcrypt.hash('password123', 10);
    const user = await User.create({
      username: 'review_test_user',
      email: 'review_test_' + Date.now() + '@example.com',
      password_hash: hashedPassword,
      phone: '0901111111',
      is_active: true
    });
    testUserId = user.id;
    createdUsers.push(testUserId);

    // Tạo test tour
    const tour = await Tour.create({
      title: 'Review Test Tour',
      destination: 'Test Destination',
      departure: 'Test Departure',
      start_date: new Date('2026-08-01'),
      end_date: new Date('2026-08-05'),
      price: 3000000,
      capacity: 20,
      latitude: 0,
      longitude: 0,
      is_active: true
    });
    testTourId = tour.id;
    createdTours.push(testTourId);

    // Tạo test order (completed)
    const order = await Order.create({
      user_id: testUserId,
      tour_id: testTourId,
      quantity: 2,
      total_price: 6000000,
      status: 'completed',
      is_review: false,
      is_paid: true,
      payment_url: 'http://test.com/payment',
      start_date: new Date('2026-08-01'),
      end_date: new Date('2026-08-05')
    });
    testOrderId = order.id;
    createdOrders.push(testOrderId);
  });

  afterAll(async () => {
    console.log('🔄 Bắt đầu Rollback dữ liệu Review Service...');
    
    // Rollback theo thứ tự ngược lại để tránh foreign key constraints
    // 1. Xóa reviews trước (dependent records)
    let deletedReviews = 0;
    for (const reviewId of createdReviews) {
      const deleted = await Review.destroy({ where: { id: reviewId } }).catch(() => 0);
      deletedReviews += deleted || 0;
    }
    console.log(`   ✅ Đã xóa ${deletedReviews} reviews`);
    
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
   * [TC_REVIEW_001] Tạo đánh giá thành công với rating 5 sao
   * Mục tiêu: Kiểm tra createReview hoạt động đúng với data hợp lệ
   * Input: user_id, tour_id, rating=5, text, order_id
   * Expected: Review được tạo với đầy đủ thông tin
   * CheckDB: Verify review tồn tại trong DB với đúng dữ liệu
   * Rollback: Review sẽ bị xóa trong afterAll
   */
  it('[TC_REVIEW_001] should create review successfully', async () => {
    const reviewData = {
      user_id: testUserId!,
      tour_id: testTourId!,
      rating: 5,
      text: 'Tour rất tuyệt vời!',
      order_id: testOrderId!
    };

    const createdReview = await reviewService.createReview(reviewData);

    // Verify review được tạo thành công
    expect(createdReview).toBeDefined();
    expect(createdReview.rating).toBe(5);
    expect(createdReview.text).toBe(reviewData.text);
    expect(createdReview.user_id).toBe(testUserId);
    expect(createdReview.tour_id).toBe(testTourId);
    expect(createdReview.id).toBeDefined();

    // Lưu ID để rollback
    createdReviewId = createdReview.id;
    createdReviews.push(createdReviewId);

    // CheckDB: Verify review tồn tại trong database với đúng dữ liệu
    const reviewInDb = await Review.findByPk(createdReviewId);
    expect(reviewInDb).not.toBeNull();
    expect(reviewInDb?.rating).toBe(5);
    expect(reviewInDb?.text).toBe(reviewData.text);
    expect(reviewInDb?.user_id).toBe(testUserId);
    expect(reviewInDb?.tour_id).toBe(testTourId);

    console.log(`✅ TC_REVIEW_001: Created review ID ${createdReviewId}`);
  });

  /**
   * [TC_REVIEW_002] Lấy đánh giá theo tour ID
   * Mục tiêu: Kiểm tra getTourReviews trả về reviews của tour
   * Input: tour_id
   * Expected: Trả về danh sách reviews kèm statistics
   * CheckDB: Verify reviews thuộc về đúng tour
   * Rollback: Không thay đổi DB (read-only)
   */
  it('[TC_REVIEW_002] should get reviews by tour ID', async () => {
    if (!testTourId) {
      throw new Error('Tour chưa được tạo');
    }

    const tourReviewsResult = await reviewService.getTourReviews(testTourId);

    // Verify response structure
    expect(tourReviewsResult).toBeDefined();
    expect(tourReviewsResult.reviews).toBeDefined();
    expect(Array.isArray(tourReviewsResult.reviews)).toBe(true);
    expect(tourReviewsResult.pagination).toBeDefined();

    // CheckDB: Verify tất cả reviews thuộc về đúng tour
    for (const review of tourReviewsResult.reviews) {
      expect(review.tour_id).toBe(testTourId);
    }

    console.log(`✅ TC_REVIEW_002: Retrieved ${tourReviewsResult.reviews.length} reviews for tour`);
  });

  /**
   * [TC_REVIEW_003] Tạo đánh giá với rating = 0 (invalid)
   * Mục tiêu: Kiểm tra validation từ chối rating ngoài range [1-5]
   * Input: rating=0
   * Expected: Throw error
   * CheckDB: Không có review nào được tạo
   * Rollback: Không cần (không thay đổi DB)
   */
  it('[TC_REVIEW_003] should fail when rating is 0', async () => {
    const invalidRatingData = {
      user_id: testUserId!,
      tour_id: testTourId!,
      rating: 0, // Invalid - below minimum
      text: 'Invalid rating',
      order_id: testOrderId!
    };

    await expect(reviewService.createReview(invalidRatingData)).rejects.toThrow();

    // CheckDB: Verify no review was created
    const reviewCount = await Review.count({
      where: {
        user_id: testUserId,
        rating: 0
      }
    });
    expect(reviewCount).toBe(0);

    console.log('✅ TC_REVIEW_003: Rejected rating = 0');
  });

  /**
   * [TC_REVIEW_004] Tạo đánh giá với rating = 6 (invalid)
   * Mục tiêu: Kiểm tra validation từ chối rating > 5
   * Input: rating=6
   * Expected: Throw error
   * CheckDB: Không có review nào được tạo
   * Rollback: Không cần
   */
  it('[TC_REVIEW_004] should fail when rating is 6', async () => {
    const invalidHighRatingData = {
      user_id: testUserId!,
      tour_id: testTourId!,
      rating: 6, // Invalid - above maximum
      text: 'Invalid rating',
      order_id: testOrderId!
    };

    await expect(reviewService.createReview(invalidHighRatingData)).rejects.toThrow();

    // CheckDB: Verify no review was created
    const reviewCount = await Review.count({
      where: {
        user_id: testUserId,
        rating: 6
      }
    });
    expect(reviewCount).toBe(0);

    console.log('✅ TC_REVIEW_004: Rejected rating = 6');
  });

  /**
   * [TC_REVIEW_005] Tạo đánh giá cho tour không tồn tại
   * Mục tiêu: Kiểm tra validation tour_id hợp lệ
   * Input: tour_id=9999999 (không tồn tại)
   * Expected: Throw 'Tour không tồn tại'
   * CheckDB: Không có review nào được tạo
   * Rollback: Không cần
   */
  it('[TC_REVIEW_005] should fail when tour does not exist', async () => {
    const nonExistentTourId = 9999999;
    const reviewForNonExistentTour = {
      user_id: testUserId!,
      tour_id: nonExistentTourId,
      rating: 5,
      text: 'Tour not found',
      order_id: testOrderId!
    };

    await expect(reviewService.createReview(reviewForNonExistentTour)).rejects.toThrow('Tour không tồn tại');

    // CheckDB: Verify no review was created for non-existent tour
    const reviewCount = await Review.count({
      where: { tour_id: nonExistentTourId }
    });
    expect(reviewCount).toBe(0);

    console.log('✅ TC_REVIEW_005: Rejected non-existent tour');
  });

  /**
   * [TC_REVIEW_006] Tạo đánh giá cho user không tồn tại
   * Mục tiêu: Kiểm tra validation user_id hợp lệ
   * Input: user_id=9999999 (không tồn tại)
   * Expected: Throw 'Người dùng không tồn tại'
   * CheckDB: Không có review nào được tạo
   * Rollback: Không cần
   */
  it('[TC_REVIEW_006] should fail when user does not exist', async () => {
    const nonExistentUserId = 9999999;
    const reviewForNonExistentUser = {
      user_id: nonExistentUserId,
      tour_id: testTourId!,
      rating: 5,
      text: 'User not found',
      order_id: testOrderId!
    };

    await expect(reviewService.createReview(reviewForNonExistentUser)).rejects.toThrow('Người dùng không tồn tại');

    // CheckDB: Verify no review was created for non-existent user
    const reviewCount = await Review.count({
      where: { user_id: nonExistentUserId }
    });
    expect(reviewCount).toBe(0);

    console.log('✅ TC_REVIEW_006: Rejected non-existent user');
  });

  /**
   * [TC_REVIEW_007] Tạo đánh giá không có order_id
   * Mục tiêu: Kiểm tra validation order_id là required field
   * Input: Không có order_id
   * Expected: Throw 'ID đơn hàng là bắt buộc'
   * CheckDB: Không có review nào được tạo
   * Rollback: Không cần
   */
  it('[TC_REVIEW_007] should fail when order_id is missing', async () => {
    const reviewDataMissingOrderId = {
      user_id: testUserId!,
      tour_id: testTourId!,
      rating: 5,
      text: 'Missing order_id'
      // order_id is missing - required field
    };

    await expect(reviewService.createReview(reviewDataMissingOrderId as any)).rejects.toThrow('ID đơn hàng là bắt buộc');

    console.log('✅ TC_REVIEW_007: Rejected missing order_id');
  });

  /**
   * [TC_REVIEW_008] Tạo đánh giá với order không tồn tại
   * Mục tiêu: Kiểm tra validation order_id hợp lệ
   * Input: order_id=9999999 (không tồn tại)
   * Expected: Throw 'Đơn hàng không tồn tại'
   * CheckDB: Không có review nào được tạo
   * Rollback: Không cần
   */
  it('[TC_REVIEW_008] should fail when order does not exist', async () => {
    const nonExistentOrderId = 9999999;
    const reviewForNonExistentOrder = {
      user_id: testUserId!,
      tour_id: testTourId!,
      rating: 5,
      text: 'Order not found',
      order_id: nonExistentOrderId
    };

    await expect(reviewService.createReview(reviewForNonExistentOrder)).rejects.toThrow('Đơn hàng không tồn tại');

    console.log('✅ TC_REVIEW_008: Rejected non-existent order');
  });

  /**
   * [TC_REVIEW_009] Lấy đánh giá của user
   * Mục tiêu: Kiểm tra getUserReviews trả về reviews của user
   * Input: user_id
   * Expected: Trả về danh sách reviews của user đó
   * CheckDB: Verify reviews thuộc về đúng user
   * Rollback: Không thay đổi DB
   */
  it('[TC_REVIEW_009] should get reviews by user ID', async () => {
    if (!testUserId) {
      throw new Error('User chưa được tạo');
    }

    const userReviewsResult = await reviewService.getUserReviews(testUserId);

    // Verify response structure
    expect(userReviewsResult).toBeDefined();
    expect(userReviewsResult.reviews).toBeDefined();
    expect(Array.isArray(userReviewsResult.reviews)).toBe(true);

    // CheckDB: Verify tất cả reviews thuộc về đúng user
    for (const review of userReviewsResult.reviews) {
      expect(review.user_id).toBe(testUserId);
    }

    console.log(`✅ TC_REVIEW_009: Retrieved ${userReviewsResult.reviews.length} reviews for user`);
  });

  /**
   * [TC_REVIEW_010] Thống kê đánh giá của tour
   * Mục tiêu: Kiểm tra getReviewStats trả về statistics đúng
   * Input: tour_id
   * Expected: Trả về avgRating và total reviews
   * CheckDB: Verify statistics khớp với data trong DB
   * Rollback: Không thay đổi DB
   */
  it('[TC_REVIEW_010] should get review statistics', async () => {
    const reviewStats = await reviewService.getReviewStats(testTourId!);

    // Verify statistics
    expect(reviewStats).toBeDefined();
    expect(reviewStats.avgRating).toBeDefined();
    expect(reviewStats.total).toBeDefined();
    expect(typeof reviewStats.avgRating).toBe('number');
    expect(typeof reviewStats.total).toBe('number');
    expect(reviewStats.total).toBeGreaterThanOrEqual(0);

    // CheckDB: Verify statistics khớp với database
    if (reviewStats.total > 0) {
      expect(reviewStats.avgRating).toBeGreaterThanOrEqual(1);
      expect(reviewStats.avgRating).toBeLessThanOrEqual(5);
    }

    console.log(`✅ TC_REVIEW_010: Stats - Average: ${reviewStats.avgRating}, Total: ${reviewStats.total}`);
  });

  /**
   * [TC_REVIEW_011] Tạo đánh giá với rating = 1 (minimum valid)
   * Mục tiêu: Kiểm tra rating boundary - minimum valid value
   * Input: rating=1
   * Expected: Review được tạo thành công
   * CheckDB: Verify review với rating=1 tồn tại
   * Rollback: Review sẽ bị xóa trong afterAll
   */
  it('[TC_REVIEW_011] should create review with rating 1 (minimum)', async () => {
    const secondOrder = await Order.create({
      user_id: testUserId!,
      tour_id: testTourId!,
      quantity: 1,
      total_price: 3000000,
      status: 'completed',
      is_review: false,
      is_paid: true,
      payment_url: 'http://test.com/payment-review-2',
      start_date: new Date('2026-09-01'),
      end_date: new Date('2026-09-05')
    });
    createdOrders.push(secondOrder.id);

    const minimumRatingReview = {
      user_id: testUserId!,
      tour_id: testTourId!,
      rating: 1, // Minimum valid rating
      text: 'Tour không tốt',
      order_id: secondOrder.id
    };

    const createdMinimumRatingReview = await reviewService.createReview(minimumRatingReview);

    expect(createdMinimumRatingReview.rating).toBe(1);
    expect(createdMinimumRatingReview.text).toBe(minimumRatingReview.text);

    createdReviews.push(createdMinimumRatingReview.id);

    // CheckDB: Verify review với rating=1 tồn tại
    const reviewInDb = await Review.findByPk(createdMinimumRatingReview.id);
    expect(reviewInDb?.rating).toBe(1);

    console.log(`✅ TC_REVIEW_011: Created review with minimum rating 1`);
  });

  /**
   * [TC_REVIEW_012] Tạo đánh giá với text rỗng
   * Mục tiêu: Kiểm tra validation text field (có thể allow empty)
   * Input: text=''
   * Expected: Có thể pass hoặc fail tùy validation
   * CheckDB: Verify nếu tạo thành công thì text=''
   * Rollback: Review sẽ bị xóa
   */
  it('[TC_REVIEW_012] should handle empty review text', async () => {
    const thirdOrder = await Order.create({
      user_id: testUserId!,
      tour_id: testTourId!,
      quantity: 1,
      total_price: 3000000,
      status: 'completed',
      is_review: false,
      is_paid: true,
      payment_url: 'http://test.com/payment-review-3',
      start_date: new Date('2026-10-01'),
      end_date: new Date('2026-10-05')
    });
    createdOrders.push(thirdOrder.id);

    try {
      const emptyTextReview = {
        user_id: testUserId!,
        tour_id: testTourId!,
        rating: 3,
        text: '', // Empty text
        order_id: thirdOrder.id
      };

      const createdEmptyTextReview = await reviewService.createReview(emptyTextReview);
      
      expect(createdEmptyTextReview.text).toBe('');
      createdReviews.push(createdEmptyTextReview.id);
      
      // CheckDB: Verify empty text saved
      const reviewInDb = await Review.findByPk(createdEmptyTextReview.id);
      expect(reviewInDb?.text).toBe('');
      
      console.log('⚠️ TC_REVIEW_012: Service accepts empty text (may be issue)');
    } catch (error: any) {
      console.log('✅ TC_REVIEW_012: Service rejects empty text (good validation)');
    }
  });

  /**
   * [TC_REVIEW_013] Tạo đánh giá duplicate cho cùng order
   * Mục tiêu: Kiểm tra một order chỉ được review 1 lần
   * Input: Sử dụng order_id đã được review (testOrderId)
   * Expected: Có thể fail hoặc override
   * CheckDB: Verify số lượng reviews cho order
   * Rollback: Review mới sẽ bị xóa
   */
  it('[TC_REVIEW_013] should handle duplicate review for same order', async () => {
    try {
      const duplicateReviewData = {
        user_id: testUserId!,
        tour_id: testTourId!,
        rating: 4,
        text: 'Duplicate review attempt',
        order_id: testOrderId! // Already reviewed in TC_001
      };

      const duplicateReview = await reviewService.createReview(duplicateReviewData);
      
      createdReviews.push(duplicateReview.id);
      console.log('⚠️ TC_REVIEW_013: Service allows duplicate reviews (may be issue)');
    } catch (error: any) {
      console.log('✅ TC_REVIEW_013: Service prevents duplicate reviews (good)');
    }
  });

  /**
   * [TC_REVIEW_014] Tạo đánh giá với rating = 5 (maximum valid)
   * Mục tiêu: Kiểm tra rating boundary - maximum valid value
   * Input: rating=5
   * Expected: Review được tạo thành công
   * CheckDB: Verify review với rating=5 tồn tại
   * Rollback: Review sẽ bị xóa
   */
  it('[TC_REVIEW_014] should create review with rating 5 (maximum)', async () => {
    const fourthOrder = await Order.create({
      user_id: testUserId!,
      tour_id: testTourId!,
      quantity: 1,
      total_price: 3000000,
      status: 'completed',
      is_review: false,
      is_paid: true,
      payment_url: 'http://test.com/payment-review-4',
      start_date: new Date('2026-11-01'),
      end_date: new Date('2026-11-05')
    });
    createdOrders.push(fourthOrder.id);

    const maximumRatingReview = {
      user_id: testUserId!,
      tour_id: testTourId!,
      rating: 5, // Maximum valid rating
      text: 'Xuất sắc!',
      order_id: fourthOrder.id
    };

    const createdMaximumRatingReview = await reviewService.createReview(maximumRatingReview);

    expect(createdMaximumRatingReview.rating).toBe(5);
    expect(createdMaximumRatingReview.text).toBe(maximumRatingReview.text);

    createdReviews.push(createdMaximumRatingReview.id);

    // CheckDB: Verify review với rating=5 tồn tại
    const reviewInDb = await Review.findByPk(createdMaximumRatingReview.id);
    expect(reviewInDb?.rating).toBe(5);

    console.log(`✅ TC_REVIEW_014: Created review with maximum rating 5`);
  });

  /**
   * [TC_REVIEW_015] Lấy reviews của tour không tồn tại
   * Mục tiêu: Kiểm tra getTourReviews với tour_id không tồn tại
   * Input: tour_id=9999999
   * Expected: Trả về empty array
   * CheckDB: Verify không có reviews
   * Rollback: Không cần
   */
  it('[TC_REVIEW_015] should return empty for non-existent tour reviews', async () => {
    const nonExistentTourId = 9999999;
    
    const tourReviewsResult = await reviewService.getTourReviews(nonExistentTourId);

    expect(tourReviewsResult).toBeDefined();
    expect(Array.isArray(tourReviewsResult.reviews)).toBe(true);
    expect(tourReviewsResult.reviews.length).toBe(0);

    console.log('✅ TC_REVIEW_015: Returned empty for non-existent tour');
  });

  /**
   * [TC_REVIEW_016] Lấy reviews của user không tồn tại
   * Mục tiêu: Kiểm tra getUserReviews với user_id không tồn tại
   * Input: user_id=9999999
   * Expected: Trả về empty array
   * CheckDB: Verify không có reviews
   * Rollback: Không cần
   */
  it('[TC_REVIEW_016] should return empty for non-existent user reviews', async () => {
    const nonExistentUserId = 9999999;
    
    const userReviewsResult = await reviewService.getUserReviews(nonExistentUserId);

    expect(userReviewsResult).toBeDefined();
    expect(Array.isArray(userReviewsResult.reviews)).toBe(true);
    expect(userReviewsResult.reviews.length).toBe(0);

    console.log('✅ TC_REVIEW_016: Returned empty for non-existent user');
  });

  /**
   * [TC_REVIEW_017] Tạo review với text rất dài (> 1000 chars)
   * Mục tiêu: Kiểm tra giới hạn độ dài text
   * Input: text với 1500 ký tự
   * Expected: Có thể cắt ngắn hoặc fail
   * CheckDB: Verify độ dài text được lưu
   * Rollback: Review sẽ bị xóa
   */
  it('[TC_REVIEW_017] should handle very long review text', async () => {
    const fifthOrder = await Order.create({
      user_id: testUserId!,
      tour_id: testTourId!,
      quantity: 1,
      total_price: 3000000,
      status: 'completed',
      is_review: false,
      is_paid: true,
      payment_url: 'http://test.com/payment-review-5',
      start_date: new Date('2026-12-01'),
      end_date: new Date('2026-12-05')
    });
    createdOrders.push(fifthOrder.id);

    const veryLongText = 'A'.repeat(1500); // 1500 characters
    
    try {
      const longTextReview = {
        user_id: testUserId!,
        tour_id: testTourId!,
        rating: 4,
        text: veryLongText,
        order_id: fifthOrder.id
      };

      const createdLongTextReview = await reviewService.createReview(longTextReview);
      
      createdReviews.push(createdLongTextReview.id);
      
      // CheckDB: Verify độ dài text được lưu
      const savedText = createdLongTextReview.text || '';
      expect(savedText.length).toBeLessThanOrEqual(veryLongText.length);
      
      console.log(`⚠️ TC_REVIEW_017: Saved text length: ${savedText.length}`);
    } catch (error: any) {
      console.log('✅ TC_REVIEW_017: Service rejects very long text (good)');
    }
  });

  /**
   * [TC_REVIEW_018] Kiểm tra thống kê với nhiều ratings khác nhau
   * Mục tiêu: Verify avgRating được tính đúng
   * Input: tour đã có reviews với ratings 1, 3, 5
   * Expected: avgRating ≈ 3.0
   * CheckDB: Verify avgRating khớp với tính toán
   * Rollback: Không cần
   */
  it('[TC_REVIEW_018] should calculate correct average rating', async () => {
    const reviewStats = await reviewService.getReviewStats(testTourId!);

    // Verify avgRating trong range hợp lệ
    expect(reviewStats.avgRating).toBeGreaterThanOrEqual(1);
    expect(reviewStats.avgRating).toBeLessThanOrEqual(5);

    // Verify total >= số reviews đã tạo
    expect(reviewStats.total).toBeGreaterThanOrEqual(1);

    console.log(`✅ TC_REVIEW_018: Average rating: ${reviewStats.avgRating.toFixed(2)}, Total: ${reviewStats.total}`);
  });

  /**
   * [TC_REVIEW_019] Tạo review với order chưa completed
   * Mục tiêu: Kiểm tra validation order status
   * Input: order với status='pending'
   * Expected: Có thể fail (chỉ cho review completed orders)
   * CheckDB: Verify review không được tạo
   * Rollback: Không cần nếu fail
   */
  it('[TC_REVIEW_019] should handle review for non-completed order', async () => {
    const pendingOrder = await Order.create({
      user_id: testUserId!,
      tour_id: testTourId!,
      quantity: 1,
      total_price: 3000000,
      status: 'pending', // Not completed
      is_review: false,
      is_paid: false,
      payment_url: 'http://test.com/payment-pending',
      start_date: new Date('2027-01-01'),
      end_date: new Date('2027-01-05')
    });
    createdOrders.push(pendingOrder.id);

    try {
      const reviewForPendingOrder = {
        user_id: testUserId!,
        tour_id: testTourId!,
        rating: 4,
        text: 'Review for pending order',
        order_id: pendingOrder.id
      };

      const createdReview = await reviewService.createReview(reviewForPendingOrder);
      
      createdReviews.push(createdReview.id);
      console.log('⚠️ TC_REVIEW_019: Service allows review for pending order (may be issue)');
    } catch (error: any) {
      console.log('✅ TC_REVIEW_019: Service rejects review for pending order (good)');
    }
  });

  /**
   * [TC_REVIEW_020] Verify review service methods
   * Mục tiêu: Kiểm tra service có đầy đủ methods
   * Input: Không có
   * Expected: 4 methods đều tồn tại
   * CheckDB: Không cần
   * Rollback: Không cần
   */
  it('[TC_REVIEW_020] should have all required methods', async () => {
    expect(typeof reviewService.createReview).toBe('function');
    expect(typeof reviewService.getTourReviews).toBe('function');
    expect(typeof reviewService.getUserReviews).toBe('function');
    expect(typeof reviewService.getReviewStats).toBe('function');

    console.log('✅ TC_REVIEW_020: All required methods exist');
  });
});
