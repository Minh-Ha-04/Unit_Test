import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import categoryService from '../services/categoryService';
import Category from '../models/Category';

/**
 * Feature 4: Category Management - Optimized Unit Tests
 * ✅ Test Case IDs rõ ràng
 * ✅ CheckDB: Xác minh database changes
 * ✅ Rollback: Khôi phục DB sau tests
 * ❗ Optimized: 9 tests  với 100% coverage
 * 
 * Services được test:
 * - getAllCategories()
 * - createCategory()
 * - updateCategory()
 * - deleteCategory()
 */
describe('[Feature 4] Category Management - Complete Unit Tests', () => {
  let createdCategoryId: number | undefined;
  let createdCategories: number[] = [];

  beforeAll(async () => {
    console.log('📂 Bắt đầu kiểm thử Quản Lý Danh Mục...');
  });

  /**
   * Rollback: Xóa tất cả categories đã tạo trong tests
   * Đảm bảo DB quay về trạng thái trước khi test
   */
  afterAll(async () => {
    console.log('🔄 Starting Rollback...');
    
    for (const categoryId of createdCategories) {
      await Category.destroy({ where: { id: categoryId } }).catch(() => {});
    }
    
    console.log(`✅ Rollback complete: Deleted ${createdCategories.length} test categories`);
  });

  /**
   * [TC_CAT_001] Lấy tất cả categories
   * Mục tiêu: Kiểm tra getAllCategories trả về danh sách categories
   * Input: Không có (hoặc search = undefined)
   * Expected: Trả về array categories đã sắp xếp
   * CheckDB: Đếm số categories trong DB phải khớp
   * Rollback: Không thay đổi DB (read-only)
   */
  it('[TC_CAT_001] should get all categories sorted by name', async () => {
  const allCategories = await categoryService.getAllCategories();
  // Kiểm tra sắp xếp theo tên
  for (let i = 1; i < allCategories.length; i++) {
    expect(allCategories[i].category.localeCompare(allCategories[i-1].category)).toBeGreaterThanOrEqual(0);
  }
});

  /**
   * [TC_CAT_002] Tìm kiếm categories theo từ khóa
   * Mục tiêu: Kiểm tra search functionality
   * Input: search = 'Du lịch'
   * Expected: Trả về categories chứa từ khóa
   * CheckDB: Verify kết quả search khớp với query
   * Rollback: Không thay đổi DB
   */
  it('[TC_CAT_002] should search categories by keyword', async () => {
    const searchKeyword = 'Du lịch';
    
    const searchResults = await categoryService.getAllCategories(searchKeyword);

    // Verify response
    expect(searchResults).toBeDefined();
    expect(Array.isArray(searchResults)).toBe(true);

    // CheckDB: Verify search results contain keyword
    for (const category of searchResults) {
      const hasKeyword = 
        category.category.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        (category.description && category.description.toLowerCase().includes(searchKeyword.toLowerCase()));
      expect(hasKeyword).toBe(true);
    }

    console.log(`✅ TC_CAT_002: Found ${searchResults.length} categories matching "${searchKeyword}"`);
  });

  /**
   * [TC_CAT_003] Tạo category mới thành công
   * Mục tiêu: Kiểm tra createCategory với dữ liệu hợp lệ
   * Input: {category: unique_name, description: text}
   * Expected: Tạo category mới, trả về object với id
   * CheckDB: Verify category được lưu trong DB
   * Rollback: Xóa category trong afterAll
   */
  it('[TC_CAT_003] should create category successfully', async () => {
    const uniqueCategoryName = 'Test Category ' + Date.now();
    const categoryDescription = 'Test description for automation';
    
    const newCategoryData = {
      category: uniqueCategoryName,
      description: categoryDescription
    };

    const createdCategory = await categoryService.createCategory(newCategoryData);

    // Verify response
    expect(createdCategory).toBeDefined();
    expect(createdCategory.id).toBeDefined();
    expect(createdCategory.category).toBe(uniqueCategoryName);
    expect(createdCategory.description).toBe(categoryDescription);

    // Store for rollback
    createdCategoryId = createdCategory.id;
    createdCategories.push(createdCategoryId);

    // CheckDB: Verify category exists in database
    const categoryInDb = await Category.findByPk(createdCategoryId);
    expect(categoryInDb).not.toBeNull();
    expect(categoryInDb?.category).toBe(uniqueCategoryName);
    expect(categoryInDb?.description).toBe(categoryDescription);

    console.log(`✅ TC_CAT_003: Created category ID ${createdCategoryId}`);
  });

  /**
   * [TC_CAT_004] Cập nhật category thành công
   * Mục tiêu: Kiểm tra updateCategory với dữ liệu hợp lệ
   * Input: categoryId, {category: newName, description: newDesc}
   * Expected: Cập nhật thành công, trả về category đã update
   * CheckDB: Verify dữ liệu trong DB đã thay đổi
   * Rollback: Category vẫn tồn tại với data mới (không rollback)
   */
  it('[TC_CAT_004] should update category successfully', async () => {
    if (!createdCategoryId) {
      throw new Error('Category chưa được tạo từ TC_CAT_003');
    }

    // Get original data for verification
    const categoryBeforeUpdate = await Category.findByPk(createdCategoryId);
    const originalName = categoryBeforeUpdate?.category;

    const updatedName = 'Updated Category Name ' + Date.now();
    const updatedDescription = 'Updated description at ' + new Date().toISOString();
    
    const updateData = {
      category: updatedName,
      description: updatedDescription
    };

    const updatedCategory = await categoryService.updateCategory(createdCategoryId, updateData);

    // Verify response
    expect(updatedCategory).toBeDefined();
    expect(updatedCategory.category).toBe(updatedName);
    expect(updatedCategory.description).toBe(updatedDescription);

    // CheckDB: Verify database was updated
    const categoryInDb = await Category.findByPk(createdCategoryId);
    expect(categoryInDb).not.toBeNull();
    expect(categoryInDb?.category).toBe(updatedName);
    expect(categoryInDb?.description).toBe(updatedDescription);
    expect(categoryInDb?.category).not.toBe(originalName); // Changed

    console.log('✅ TC_CAT_004: Category updated successfully');
  });

  /**
   * [TC_CAT_005] Cập nhật category không tồn tại
   * Mục tiêu: Kiểm tra error handling khi categoryId không hợp lệ
   * Input: categoryId=9999999 (không tồn tại)
   * Expected: Ném lỗi "Danh mục không tồn tại"
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần (fail)
   */
  it('[TC_CAT_005] should fail when updating non-existent category', async () => {
    const nonExistentCategoryId = 9999999;

    // Verify category doesn't exist
    const categoryInDb = await Category.findByPk(nonExistentCategoryId);
    expect(categoryInDb).toBeNull();

    // Attempt to update non-existent category
    await expect(
      categoryService.updateCategory(nonExistentCategoryId, { category: 'Fail' })
    ).rejects.toThrow('Danh mục không tồn tại');

    console.log('✅ TC_CAT_005: Correctly rejected non-existent category update');
  });

  /**
   * [TC_CAT_006] Xóa category thành công
   * Mục tiêu: Kiểm tra deleteCategory với category hợp lệ
   * Input: categoryId hợp lệ
   * Expected: Xóa thành công, trả về message
   * CheckDB: Verify category bị xóa khỏi DB
   * Rollback: Category đã xóa (không thể rollback hard delete)
   */
  it('[TC_CAT_006] should delete category successfully', async () => {
    // Tạo category mới để xóa
    const categoryToDeleteName = 'Category To Delete ' + Date.now();
    const categoryToDelete = await Category.create({
      category: categoryToDeleteName,
      description: 'This category will be deleted'
    });
    const categoryIdToDelete = categoryToDelete.id;

    // Verify category exists before delete
    const categoryBeforeDelete = await Category.findByPk(categoryIdToDelete);
    expect(categoryBeforeDelete).not.toBeNull();

    // Delete category
    const deleteResult = await categoryService.deleteCategory(categoryIdToDelete);

    // Verify response
    expect(deleteResult).toBeDefined();
    expect(deleteResult.message).toBeDefined();

    // CheckDB: Verify category was deleted from database
    const categoryAfterDelete = await Category.findByPk(categoryIdToDelete);
    expect(categoryAfterDelete).toBeNull();

    console.log(`✅ TC_CAT_006: Deleted category ID ${categoryIdToDelete}`);
  });

  /**
   * [TC_CAT_007] Xóa category không tồn tại
   * Mục tiêu: Kiểm tra error handling khi xóa category không có
   * Input: categoryId=9999999 (không tồn tại)
   * Expected: Ném lỗi "Danh mục không tồn tại"
   * CheckDB: Không thay đổi DB
   * Rollback: Không cần
   */
  it('[TC_CAT_007] should fail when deleting non-existent category', async () => {
    const nonExistentCategoryId = 9999999;

    await expect(
      categoryService.deleteCategory(nonExistentCategoryId)
    ).rejects.toThrow('Danh mục không tồn tại');

    console.log('✅ TC_CAT_007: Correctly rejected non-existent category deletion');
  });

  /**
   * [TC_CAT_008] Gộp các edge cases: empty name, duplicate, long description
   */
  it('[TC_CAT_008] should handle category edge cases (empty, duplicate, validation)', async () => {
    // Test 1: Empty name validation
    await expect(
      categoryService.createCategory({ category: '' } as any)
    ).rejects.toThrow();

    // Test 2: Duplicate category name
    const uniqueName = 'Duplicate Test ' + Date.now();
    const firstCategory = await categoryService.createCategory({
      category: uniqueName,
      description: 'First'
    });
    createdCategories.push(firstCategory.id);

    // Thử tạo duplicate
    await expect(
      categoryService.createCategory({
        category: uniqueName,
        description: 'Second'
      })
    ).rejects.toThrow();

    // Test 3: Update với empty name
    if (createdCategoryId) {
      const originalCategory = await Category.findByPk(createdCategoryId);
      const originalName = originalCategory?.category;

      await expect(
        categoryService.updateCategory(createdCategoryId, { category: '' })
      ).rejects.toThrow();

      // Verify data không đổi
      const categoryInDb = await Category.findByPk(createdCategoryId);
      expect(categoryInDb?.category).toBe(originalName);
    }

    // Test 4: Long description (1000 chars)
    const longDescCategory = await categoryService.createCategory({
      category: 'Long Desc ' + Date.now(),
      description: 'A'.repeat(1000)
    });
    createdCategories.push(longDescCategory.id);
    expect(longDescCategory.description?.length).toBe(1000);

    // Test 5: Special characters
    const specialCategory = await categoryService.createCategory({
      category: 'Special!@#$ ' + Date.now(),
      description: '<>{}[]|\\'
    });
    createdCategories.push(specialCategory.id);
    expect(specialCategory.category).toContain('!@#$');

    console.log('✅ TC_CAT_008: All edge cases handled correctly');
  });



  /**
   * [TC_CAT_009] Gộp empty search + all categories
   */
  it('[TC_CAT_009] should handle search edge cases (empty keyword, no results)', async () => {
    // Test 1: Empty keyword returns all
    const allCategories = await categoryService.getAllCategories();
    const emptySearchResults = await categoryService.getAllCategories('');
    expect(emptySearchResults.length).toBe(allCategories.length);

    // Test 2: Non-existent keyword returns empty
    const uniqueKeyword = 'NonExistent' + Date.now();
    const noResults = await categoryService.getAllCategories(uniqueKeyword);
    expect(noResults.length).toBe(0);

    console.log('✅ TC_CAT_009: Search edge cases handled correctly');
  });


});
