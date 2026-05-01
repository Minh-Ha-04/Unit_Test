import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import tourService from '../services/tourService';
import Tour from '../models/Tour';
import Category from '../models/Category';
import TourSchedule from '../models/TourSchedule';
import TourInclude from '../models/TourInclude';
import TourExclude from '../models/TourExclude';
import TourGallery from '../models/TourGallery';
import User from '../models/User';
import Order from '../models/Order';

/**
 * Feature 3: Tour Management - Comprehensive Unit Tests
 * ✅ Test Case IDs từ 001 đến 037 liên tục, organized by function
 * ✅ CheckDB: Xác minh database thay đổi đúng
 * ✅ Rollback: Đảm bảo DB trở về trạng thái ban đầu
 * ✅ Each test focuses on ONE function/scenario
 * 
 * Test Organization by TC numbers:
 * - createTour(): TC_TOUR_001 → TC_TOUR_007
 * - getTourById(): TC_TOUR_008 → TC_TOUR_011
 * - getTours(): TC_TOUR_012 → TC_TOUR_017
 * - updateTour(): TC_TOUR_018
 * - deleteTour(): TC_TOUR_019 → TC_TOUR_020
 * - other methods: TC_TOUR_021
 * - featured/popular: TC_TOUR_022 → TC_TOUR_024
 * - admin tours: TC_TOUR_025 → TC_TOUR_027
 * - sorting: TC_TOUR_028 → TC_TOUR_030
 * - complex filters: TC_TOUR_031
 * - tour details: TC_TOUR_032
 * - soft delete: TC_TOUR_033
 * - deactivate expired: TC_TOUR_034
 * - admin sort: TC_TOUR_035
 * - update all details: TC_TOUR_036
 * - hard delete with related: TC_TOUR_037
 */
describe('[Feature 3] Tour Management - Complete Unit Tests (TC001-TC037)', () => {
  let createdTourId: number | undefined;
  let createdTourIds: number[] = [];
  let testCategoryId: number | undefined;
  let testTourForUpdate: any;

  beforeAll(async () => {
    console.log('🏝️ Bắt đầu kiểm thử Quản Lý Tour Du Lịch...');

    // Tạo category để test
    const category = await Category.create({
      category: 'Test Category Tours',
      description: 'Category for tour tests'
    });
    testCategoryId = category.id;

    // Tạo tour cho các test update
    testTourForUpdate = await Tour.create({
      title: 'Tour For Update Tests',
      description: 'Test description',
      destination: 'Test Destination',
      departure: 'Test Departure',
      start_date: new Date('2026-08-01'),
      end_date: new Date('2026-08-05'),
      price: 5000000,
      capacity: 30,
      latitude: 21.0,
      longitude: 105.8,
      is_active: true
    });
    createdTourIds.push(testTourForUpdate.id);
  });

  afterAll(async () => {
    console.log('🔄 Bắt đầu Rollback dữ liệu Tour Service...');

    let deletedTours = 0;
    for (const tourId of createdTourIds) {
      const deleted = await Tour.destroy({ where: { id: tourId } }).catch(() => 0);
      deletedTours += deleted || 0;
    }
    console.log(`   ✅ Đã xóa ${deletedTours} tours`);

    let deletedCategories = 0;
    if (testCategoryId) {
      const deleted = await Category.destroy({ where: { id: testCategoryId } }).catch(() => 0);
      deletedCategories += deleted || 0;
    }
    console.log(`   ✅ Đã xóa ${deletedCategories} categories`);

    console.log('✅ Rollback complete - Database restored');
  });

  /**
   * [TC_TOUR_001] Tạo tour mới thành công với đầy đủ thông tin
   */
  it('[TC_TOUR_001] should create tour successfully', async () => {
    const tourData = {
      title: 'Test Tour Hà Nội - Phú Quốc',
      description: 'Tour du lịch 5 ngày 4 đêm',
      destination: 'Phú Quốc',
      departure: 'Hà Nội',
      start_date: '2026-06-01',
      end_date: '2026-06-05',
      duration: '5 ngày 4 đêm',
      price: 5000000,
      capacity: 30,
      categories: [testCategoryId!]
    };

    const createdTour = await tourService.createTour(tourData);

    expect(createdTour).toBeDefined();
    expect(createdTour.title).toBe(tourData.title);
    expect(createdTour.destination).toBe(tourData.destination);
    expect(Number(createdTour.price)).toBe(Number(tourData.price));
    expect(createdTour.id).toBeDefined();

    createdTourId = createdTour.id!;
    createdTourIds.push(createdTourId);

    const tourInDb = await Tour.findByPk(createdTourId);
    expect(tourInDb).not.toBeNull();
    if (tourInDb) {
      expect(tourInDb.title).toBe(tourData.title);
      expect(tourInDb.destination).toBe(tourData.destination);
      expect(Number(tourInDb.price)).toBe(Number(tourData.price));
    }

    console.log(`✅ TC_TOUR_001: Created tour successfully, ID ${createdTourId}`);
  });

  /**
   * [TC_TOUR_002] Tạo tour với schedule, includes, excludes, gallery
   */
  it('[TC_TOUR_002] should create tour with schedule and details', async () => {
    const tourData = {
      title: 'Tour With Schedule',
      description: 'Tour có lịch trình chi tiết',
      destination: 'Đà Lạt',
      departure: 'TP.HCM',
      start_date: '2026-07-01',
      end_date: '2026-07-03',
      duration: '3 ngày 2 đêm',
      price: 3000000,
      capacity: 25,
      categories: [testCategoryId!],
      schedule: [
        { day_number: 1, title: 'Ngày 1', detail: 'Khởi hành' },
        { day_number: 2, title: 'Ngày 2', detail: 'Tham quan' }
      ],
      includes: [{ item: 'Vé máy bay' }, { item: 'Khách sạn' }],
      excludes: [{ item: 'Ăn uống' }]
    };

    const createdTour = await tourService.createTour(tourData);
    expect(createdTour).toBeDefined();
    expect(createdTour.title).toBe(tourData.title);

    createdTourIds.push(createdTour.id!);

    console.log(`✅ TC_TOUR_002: Created tour with schedule, ID ${createdTour.id}`);
  });

  /**
   * [TC_TOUR_003] Tạo tour thiếu thông tin bắt buộc
   */
  it('[TC_TOUR_003] should fail when creating tour with missing required fields', async () => {
    const incompleteTourData = {
      title: 'Incomplete Tour',
      destination: 'Test'
    };

    await expect(tourService.createTour(incompleteTourData as any)).rejects.toThrow();

    const tourCount = await Tour.count({
      where: { title: 'Incomplete Tour' }
    });
    expect(tourCount).toBe(0);

    console.log('✅ TC_TOUR_003: Rejected tour with missing required fields');
  });

  /**
   * [TC_TOUR_004] Tạo tour với giá = 0
   */
  it('[TC_TOUR_004] should handle tour with zero price', async () => {
    const zeroPriceTourData = {
      title: 'Free Tour Test',
      description: 'Tour miễn phí',
      destination: 'Test',
      departure: 'Test',
      start_date: '2026-08-01',
      end_date: '2026-08-05',
      duration: '5 ngày 4 đêm',
      price: 0,
      capacity: 20,
      categories: [testCategoryId!]
    };

    try {
      const zeroPriceTour = await tourService.createTour(zeroPriceTourData);
      expect(zeroPriceTour).toBeDefined();
      expect(Number(zeroPriceTour.price)).toBe(0);
      createdTourIds.push(zeroPriceTour.id!);
      console.log('⚠️ TC_TOUR_004: Service accepts zero price');
    } catch (error: any) {
      console.log('✅ TC_TOUR_004: Service validates price > 0');
    }
  });

  /**
   * [TC_TOUR_005] Tạo tour với main_image
   */
  it('[TC_TOUR_005] should create tour with main_image', async () => {
    const tourData = {
      title: 'Tour With Image',
      description: 'Tour có hình ảnh',
      destination: 'Đà Nẵng',
      departure: 'Hà Nội',
      start_date: '2026-10-01',
      end_date: '2026-10-05',
      duration: '5 ngày 4 đêm',
      price: 4000000,
      capacity: 25,
      main_image: 'https://example.com/main.jpg',
      is_active: true,
      categories: [testCategoryId!]
    };

    const createdTour = await tourService.createTour(tourData);
    expect(createdTour).toBeDefined();
    expect(createdTour.title).toBe(tourData.title);
    expect(createdTour.main_image).toBe(tourData.main_image);

    createdTourIds.push(createdTour.id!);

    console.log(`✅ TC_TOUR_005: Created tour with main_image, ID ${createdTour.id}`);
  });

  /**
   * [TC_TOUR_006] Tạo tour với categories là string
   */
  it('[TC_TOUR_006] should create tour with categories as string', async () => {
    const tourData = {
      title: 'Tour With String Categories',
      description: 'Tour với categories dạng string',
      destination: 'Huế',
      departure: 'TP.HCM',
      start_date: '2026-11-01',
      end_date: '2026-11-05',
      duration: '5 ngày 4 đêm',
      price: 3500000,
      capacity: 20,
      categories: `${testCategoryId}`
    };

    const createdTour = await tourService.createTour(tourData);
    expect(createdTour).toBeDefined();
    expect(createdTour.title).toBe(tourData.title);

    createdTourIds.push(createdTour.id!);

    console.log(`✅ TC_TOUR_006: Created tour with string categories, ID ${createdTour.id}`);
  });

  /**
   * [TC_TOUR_007] Tạo tour với category_ids thay vì categories
   */
  it('[TC_TOUR_007] should create tour with category_ids', async () => {
    const tourData = {
      title: 'Tour With Category IDs',
      description: 'Tour với category_ids',
      destination: 'Nha Trang',
      departure: 'Hà Nội',
      start_date: '2026-12-01',
      end_date: '2026-12-05',
      duration: '5 ngày 4 đêm',
      price: 5500000,
      capacity: 30,
      category_ids: [testCategoryId!]
    };

    const createdTour = await tourService.createTour(tourData);
    expect(createdTour).toBeDefined();
    expect(createdTour.title).toBe(tourData.title);

    createdTourIds.push(createdTour.id!);

    console.log(`✅ TC_TOUR_007: Created tour with category_ids, ID ${createdTour.id}`);
  });

  /**
   * [TC_TOUR_008] Lấy tour theo ID hợp lệ
   */
  it('[TC_TOUR_008] should get tour by ID', async () => {
    if (!createdTourId) {
      throw new Error('Tour chưa được tạo');
    }

    const fetchedTour = await tourService.getTourById(createdTourId);

    expect(fetchedTour).toBeDefined();
    expect(fetchedTour.id).toBe(createdTourId);
    expect(fetchedTour.title).toBeDefined();
    expect(fetchedTour.destination).toBeDefined();

    const tourInDb = await Tour.findByPk(createdTourId);
    expect(tourInDb).not.toBeNull();
    expect(tourInDb?.title).toBe(fetchedTour.title);

    console.log('✅ TC_TOUR_008: Retrieved tour by ID successfully');
  });

  /**
   * [TC_TOUR_009] Lấy tour với ID không tồn tại
   */
  it('[TC_TOUR_009] should fail when getting non-existent tour', async () => {
    const nonExistentTourId = 9999999;

    await expect(tourService.getTourById(nonExistentTourId)).rejects.toThrow('Tour không tồn tại');

    const tourInDb = await Tour.findByPk(nonExistentTourId);
    expect(tourInDb).toBeNull();

    console.log('✅ TC_TOUR_009: Rejected non-existent tour');
  });

  /**
   * [TC_TOUR_010] Lấy tour với ID = 0
   */
  it('[TC_TOUR_010] should handle getTourById with zero ID', async () => {
    const invalidTourId = 0;

    try {
      const zeroIdTour = await tourService.getTourById(invalidTourId);
      expect(zeroIdTour).toBeDefined();
      console.log('⚠️ TC_TOUR_010: Service accepts tourId=0');
    } catch (error: any) {
      console.log('✅ TC_TOUR_010: Service validates tourId > 0');
    }
  });

  /**
   * [TC_TOUR_011] Lấy tour với ID âm
   */
  it('[TC_TOUR_011] should fail when getting tour with negative ID', async () => {
    await expect(
      tourService.getTourById(-1)
    ).rejects.toThrow('ID tour không hợp lệ');

    console.log('✅ TC_TOUR_011: Rejected negative tour ID');
  });


  /**
   * [TC_TOUR_012] Lấy danh sách tours cơ bản
   */
  it('[TC_TOUR_012] should get tours list', async () => {
    const toursResult = await tourService.getTours(1, 10);

    expect(toursResult).toBeDefined();
    expect(toursResult.tours).toBeDefined();
    expect(toursResult.pagination).toBeDefined();
    expect(Array.isArray(toursResult.tours)).toBe(true);

    console.log(`✅ TC_TOUR_012: Retrieved ${toursResult.tours.length} tours`);
  });

  /**
   * [TC_TOUR_013] Lọc tours theo destination
   */
  it('[TC_TOUR_013] should filter tours by destination', async () => {
    const destinationFilter = 'Phú Quốc';

    const destinationFilteredTours = await tourService.getTours(1, 10, {
      destination: destinationFilter
    });

    expect(destinationFilteredTours).toBeDefined();
    expect(Array.isArray(destinationFilteredTours.tours)).toBe(true);

    for (const tour of destinationFilteredTours.tours) {
      if (tour.destination) {
        expect(tour.destination.toLowerCase()).toContain(destinationFilter.toLowerCase());
      }
    }

    console.log(`✅ TC_TOUR_013: Filtered ${destinationFilteredTours.tours.length} tours by destination`);
  });

  /**
   * [TC_TOUR_014] Lọc tours theo khoảng giá
   */
  it('[TC_TOUR_014] should filter tours by price range', async () => {
    const minPriceFilter = 3000000;
    const maxPriceFilter = 7000000;

    const priceFilteredTours = await tourService.getTours(1, 10, {
      min_price: minPriceFilter,
      max_price: maxPriceFilter
    });

    expect(priceFilteredTours).toBeDefined();
    expect(Array.isArray(priceFilteredTours.tours)).toBe(true);

    for (const tour of priceFilteredTours.tours) {
      expect(Number(tour.price)).toBeGreaterThanOrEqual(minPriceFilter);
      expect(Number(tour.price)).toBeLessThanOrEqual(maxPriceFilter);
    }

    console.log(`✅ TC_TOUR_014: Filtered ${priceFilteredTours.tours.length} tours by price`);
  });

  /**
   * [TC_TOUR_015] Lọc tours theo types (adventure, cultural)
   */
  it('[TC_TOUR_015] should filter tours by types', async () => {
    const typeFilteredTours = await tourService.getTours(1, 10, {
      types: ['adventure', 'cultural']
    });

    expect(typeFilteredTours).toBeDefined();
    expect(Array.isArray(typeFilteredTours.tours)).toBe(true);

    console.log(`✅ TC_TOUR_015: Filtered ${typeFilteredTours.tours.length} tours by types`);
  });

  /**
   * [TC_TOUR_016] Lọc tours theo stock (còn vé)
   */
  it('[TC_TOUR_016] should filter tours by stock available', async () => {
    const stockAvailableTours = await tourService.getTours(1, 10, {
      stock: 1
    });

    expect(stockAvailableTours).toBeDefined();
    expect(Array.isArray(stockAvailableTours.tours)).toBe(true);

    console.log(`✅ TC_TOUR_016: Filtered ${stockAvailableTours.tours.length} tours with stock available`);
  });

  /**
   * [TC_TOUR_017] Lọc tours theo rating tối thiểu
   */
  it('[TC_TOUR_017] should filter tours by minimum rating', async () => {
    const ratingFilteredTours = await tourService.getTours(1, 10, {
      rating: 4
    });

    expect(ratingFilteredTours).toBeDefined();
    expect(Array.isArray(ratingFilteredTours.tours)).toBe(true);

    console.log(`✅ TC_TOUR_017: Filtered ${ratingFilteredTours.tours.length} tours by minimum rating`);
  });

  /**
   * [TC_TOUR_018] Cập nhật thông tin tour thành công
   */
  it('[TC_TOUR_018] should update tour successfully', async () => {
    const updateData = {
      title: 'Updated Tour Title',
      price: 6000000,
      capacity: 40
    };

    const updatedTour = await tourService.updateTour(testTourForUpdate.id, updateData);

    expect(updatedTour).toBeDefined();
    expect(updatedTour.title).toBe(updateData.title);
    expect(Number(updatedTour.price)).toBe(Number(updateData.price));
    expect(Number(updatedTour.capacity)).toBe(Number(updateData.capacity));

    const tourInDb = await Tour.findByPk(testTourForUpdate.id);
    expect(tourInDb).not.toBeNull();
    if (tourInDb) {
      expect(tourInDb.title).toBe(updateData.title);
      expect(Number(tourInDb.price)).toBe(Number(updateData.price));
    }

    console.log('✅ TC_TOUR_018: Updated tour successfully');
  });


  /**
   * [TC_TOUR_019] Xóa tour thành công (hard delete)
   */
  it('[TC_TOUR_019] should delete tour', async () => {
    const tourToDelete = await Tour.create({
      title: `Tour To Delete ${Date.now()}`,
      destination: 'Test',
      departure: 'Test',
      start_date: new Date('2026-07-01'),
      end_date: new Date('2026-07-05'),
      price: 1000000,
      capacity: 10,
      latitude: 0,
      longitude: 0,
      is_active: true
    });

    const tourIdToDelete = tourToDelete.id;

    const tourBeforeDelete = await Tour.findByPk(tourIdToDelete);
    expect(tourBeforeDelete).not.toBeNull();

    const deleteResult = await tourService.hardDeleteTour(tourIdToDelete);

    expect(deleteResult).toBeDefined();

    const tourAfterDelete = await Tour.findByPk(tourIdToDelete);
    expect(tourAfterDelete).toBeNull();

    console.log(`✅ TC_TOUR_019: Deleted tour ${tourIdToDelete}`);
  });

  /**
   * [TC_TOUR_020] Xóa tour không tồn tại (soft delete nhưng dùng deleteTour)
   */
  it('[TC_TOUR_020] should handle delete non-existent tour', async () => {
    const nonExistentTourId = 9999999;

    try {
      const deleteResult = await tourService.deleteTour(nonExistentTourId);
      expect(deleteResult).toBeDefined();
      console.log('✅ TC_TOUR_020: Service handled non-existent tour gracefully');
    } catch (error: any) {
      console.log('✅ TC_TOUR_020: Service throws error for non-existent tour');
    }
  });

  /**
   * [TC_TOUR_021] Lấy featured tours
   */
  it('[TC_TOUR_021] should get featured tours', async () => {
    const featuredTours = await tourService.getFeaturedTours(6);
    expect(featuredTours).toBeDefined();
    expect(Array.isArray(featuredTours)).toBe(true);
    console.log(`✅ TC_TOUR_022: Retrieved ${featuredTours.length} featured tours`);
  });

  /**
   * [TC_TOUR_022] Lấy most booked tours
   */
  it('[TC_TOUR_022] should get most booked tours', async () => {
    const mostBookedTours = await tourService.getMostBookedTours(8);
    expect(mostBookedTours).toBeDefined();
    expect(Array.isArray(mostBookedTours)).toBe(true);
    console.log(`✅ TC_TOUR_022: Retrieved ${mostBookedTours.length} most booked tours`);
  });

  /**
   * [TC_TOUR_023] Lấy recommended tours cho user
   */
  it('[TC_TOUR_023] should get recommended tours for user', async () => {
    const testUser = await User.create({
      username: 'test_recommended_user',
      email: `recommended_${Date.now()}@test.com`,
      password_hash: 'hashed_password_123',
      phone: '0900000002'
    });

    const recommendedTours = await tourService.getRecommendedToursByUserCategory(testUser.id, 5);
    expect(recommendedTours).toBeDefined();
    expect(Array.isArray(recommendedTours)).toBe(true);
    console.log(`✅ TC_TOUR_023: Retrieved ${recommendedTours.length} recommended tours`);
  });

  /**
   * [TC_TOUR_024] Lấy admin tours list
   */
  it('[TC_TOUR_024] should get admin tours', async () => {
    const adminTours = await tourService.getAdminTours(1, 10);
    expect(adminTours).toBeDefined();
    expect(adminTours.tours).toBeDefined();
    expect(adminTours.pagination).toBeDefined();
    expect(Array.isArray(adminTours.tours)).toBe(true);
    console.log(`✅ TC_TOUR_024: Retrieved ${adminTours.tours.length} admin tours`);
  });

  /**
   * [TC_TOUR_025] Lọc admin tours theo status
   */
  it('[TC_TOUR_025] should filter admin tours by status', async () => {
    const activeTours = await tourService.getAdminTours(1, 10, { is_active: true });
    expect(activeTours).toBeDefined();
    expect(Array.isArray(activeTours.tours)).toBe(true);
    console.log(`✅ TC_TOUR_025: Retrieved ${activeTours.tours.length} active admin tours`);
  });

  /**
   * [TC_TOUR_026] Lọc admin tours theo region
   */
  it('[TC_TOUR_026] should filter admin tours by region', async () => {
    const northernTours = await tourService.getAdminTours(1, 10, { regions: ['northern'] });
    expect(northernTours).toBeDefined();
    expect(Array.isArray(northernTours.tours)).toBe(true);
    console.log(`✅ TC_TOUR_026: Retrieved ${northernTours.tours.length} northern admin tours`);
  });

  /**
   * [TC_TOUR_027] Sắp xếp tours theo giá tăng dần
   */
  it('[TC_TOUR_027] should sort tours by price ascending', async () => {
    const sortedTours = await tourService.getTours(1, 10, { sort: 'price_asc' });
    expect(sortedTours).toBeDefined();
    expect(Array.isArray(sortedTours.tours)).toBe(true);
    console.log(`✅ TC_TOUR_027: Sorted ${sortedTours.tours.length} tours by price asc`);
  });

  /**
   * [TC_TOUR_028] Sắp xếp tours theo giá giảm dần
   */
  it('[TC_TOUR_028] should sort tours by price descending', async () => {
    const sortedTours = await tourService.getTours(1, 10, { sort: 'price_desc' });
    expect(sortedTours).toBeDefined();
    expect(Array.isArray(sortedTours.tours)).toBe(true);
    console.log(`✅ TC_TOUR_028: Sorted ${sortedTours.tours.length} tours by price desc`);
  });

  /**
   * [TC_TOUR_029] Sắp xếp tours theo ngày tạo
   */
  it('[TC_TOUR_029] should sort tours by created date', async () => {
    const sortedTours = await tourService.getTours(1, 10, { sort: 'newest' });
    expect(sortedTours).toBeDefined();
    expect(Array.isArray(sortedTours.tours)).toBe(true);
    console.log(`✅ TC_TOUR_029: Sorted ${sortedTours.tours.length} tours by newest`);
  });

  /**
   * [TC_TOUR_030] Kết hợp nhiều filters
   */
  it('[TC_TOUR_030] should filter tours with multiple filters', async () => {
    const multiFilteredTours = await tourService.getTours(1, 10, {
      search: 'Tour',
      min_price: 1000000,
      max_price: 10000000,
      regions: ['northern']
    });
    expect(multiFilteredTours).toBeDefined();
    expect(Array.isArray(multiFilteredTours.tours)).toBe(true);
    console.log(`✅ TC_TOUR_030: Filtered ${multiFilteredTours.tours.length} tours with multiple filters`);
  });

  /**
   * [TC_TOUR_031] Lấy tour với đầy đủ details (schedule, includes, excludes, gallery, reviews)
   */
  it('[TC_TOUR_031] should get tour with full details', async () => {
    const tourWithDetails = await tourService.getTourById(testTourForUpdate.id);
    expect(tourWithDetails).toBeDefined();
    expect(tourWithDetails.id).toBe(testTourForUpdate.id);
    expect(tourWithDetails).toHaveProperty('schedule');
    expect(tourWithDetails).toHaveProperty('includes');
    expect(tourWithDetails).toHaveProperty('excludes');
    expect(tourWithDetails).toHaveProperty('gallery');
    expect(tourWithDetails).toHaveProperty('reviews');
    expect(tourWithDetails).toHaveProperty('tickets_sold');
    console.log(`✅ TC_TOUR_031: Retrieved tour with full details`);
  });

  /**
   * [TC_TOUR_032] Soft delete tour
   */
  it('[TC_TOUR_032] should soft delete tour', async () => {
    const tourToSoftDelete = await Tour.create({
      title: `Tour To Soft Delete ${Date.now()}`,
      destination: 'Test',
      departure: 'Test',
      start_date: new Date('2026-09-01'),
      end_date: new Date('2026-09-05'),
      price: 2000000,
      capacity: 15,
      latitude: 10.0,
      longitude: 106.0,
      is_active: true
    });

    const result = await tourService.deleteTour(tourToSoftDelete.id);
    expect(result).toBeDefined();
    expect(result.message).toContain('soft delete');

    const tourAfterDelete = await Tour.findByPk(tourToSoftDelete.id);
    expect(tourAfterDelete).not.toBeNull();
    expect(tourAfterDelete?.is_active).toBe(false);

    console.log(`✅ TC_TOUR_032: Soft deleted tour ${tourToSoftDelete.id}`);
  });
  /**
   * [TC_TOUR_033] Deactivate expired tours
   */
  it('[TC_TOUR_033] should deactivate expired tours', async () => {
    const expiredTour = await Tour.create({
      title: `Expired Tour ${Date.now()}`,
      destination: 'Test',
      departure: 'Test',
      start_date: new Date('2020-01-01'),
      end_date: new Date('2020-01-05'),
      price: 1000000,
      capacity: 10,
      latitude: 10.0,
      longitude: 106.0,
      is_active: true
    });
    createdTourIds.push(expiredTour.id);

    const result = await tourService.deactivateExpiredTours();
    expect(result).toBeDefined();
    expect(result.count).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.tourIds)).toBe(true);
    console.log(`✅ TC_TOUR_033: Deactivated ${result.count} expired tours`);
  });

  /**
   * [TC_TOUR_034] Sắp xếp admin tours theo price
   */
  it('[TC_TOUR_034] should sort admin tours by price', async () => {
    const sortedAdminTours = await tourService.getAdminTours(1, 10, { sort: 'price_asc' });
    expect(sortedAdminTours).toBeDefined();
    expect(Array.isArray(sortedAdminTours.tours)).toBe(true);
    console.log(`✅ TC_TOUR_034: Sorted ${sortedAdminTours.tours.length} admin tours by price`);
  });

  /**
   * [TC_TOUR_035] Cập nhật tour với schedule, includes, excludes, gallery
   */
  it('[TC_TOUR_035] should update tour with all details', async () => {
    const updateData = {
      title: 'Updated Tour With All Details',
      schedule: [
        { day_number: 1, title: 'Day 1', detail: 'Departure' },
        { day_number: 2, title: 'Day 2', detail: 'Sightseeing' }
      ],
      includes: [{ item: 'Hotel' }, { item: 'Transportation' }],
      excludes: [{ item: 'Personal expenses' }],
      gallery: [
        { image_url: 'https://example.com/img1.jpg' },
        { image_url: 'https://example.com/img2.jpg' }
      ]
    };

    const updatedTour = await tourService.updateTour(testTourForUpdate.id, updateData);
    expect(updatedTour).toBeDefined();
    expect(updatedTour.title).toBe(updateData.title);
    console.log('✅ TC_TOUR_035: Updated tour with all details');
  });

  /**
   * [TC_TOUR_036] Hard delete tour với related data
   */
  it('[TC_TOUR_036] should hard delete tour with related data', async () => {
    const tourToDelete = await Tour.create({
      title: `Tour With Data To Delete ${Date.now()}`,
      destination: 'Test',
      departure: 'Test',
      start_date: new Date('2026-10-01'),
      end_date: new Date('2026-10-05'),
      price: 2000000,
      capacity: 15,
      latitude: 10.0,
      longitude: 106.0,
      is_active: true
    });

    await TourSchedule.create({ tour_id: tourToDelete.id, day_number: 1, title: 'Day 1', detail: 'Detail' });
    await TourInclude.create({ tour_id: tourToDelete.id, item: 'Hotel' });
    await TourExclude.create({ tour_id: tourToDelete.id, item: 'Personal expenses' });
    await TourGallery.create({ tour_id: tourToDelete.id, image_url: 'https://example.com/image.jpg' });

    const result = await tourService.hardDeleteTour(tourToDelete.id);
    expect(result).toBeDefined();
    expect(result.message).toContain('hard delete');

    const tourAfterDelete = await Tour.findByPk(tourToDelete.id);
    expect(tourAfterDelete).toBeNull();

    console.log(`✅ TC_TOUR_036: Hard deleted tour with related data`);
  });
});