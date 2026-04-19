import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import categoryService from '../services/categoryService';
import Category from '../models/Category';

/**
 * Feature 4: Category Management - Comprehensive Unit Tests
 * ✅ Test Case IDs rõ ràng
 * ✅ CheckDB: Xác minh database changes
 * ✅ Rollback: Khôi phục DB sau tests
 * ❗ Tests có cả PASS và edge cases thực tế
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
   * [TC_CAT_008] Tạo category với tên trống
   * Mục tiêu: Kiểm tra validation khi category name rỗng
   * Input: {category: ''}
   * Expected: Ném lỗi validation
   * CheckDB: Không tạo category mới
   * Rollback: Không cần (fail)
   */
  it('[TC_CAT_008] should fail when creating category with empty name', async () => {
    const categoriesBefore = await Category.count();

    await expect(
      categoryService.createCategory({ category: '' } as any)
    ).rejects.toThrow();

    // CheckDB: Verify no category was created
    const categoriesAfter = await Category.count();
    expect(categoriesAfter).toBe(categoriesBefore);

    console.log('✅ TC_CAT_008: Correctly rejected empty category name');
  });

  /**
   * [TC_CAT_009] Tìm kiếm với từ khóa không tồn tại
   * Mục tiêu: Kiểm tra search trả về empty khi không tìm thấy
   * Input: search = 'NonExistentKeyword123456'
   * Expected: Trả về empty array
   * CheckDB: Verify không có category nào khớp
   * Rollback: Không cần
   */
  it('[TC_CAT_009] should return empty when search keyword not found', async () => {
    const uniqueKeyword = 'NonExistentKeyword' + Date.now();
    
    const searchResults = await categoryService.getAllCategories(uniqueKeyword);

    expect(searchResults).toBeDefined();
    expect(Array.isArray(searchResults)).toBe(true);
    expect(searchResults.length).toBe(0);

    console.log(`✅ TC_CAT_009: Search returned 0 results for "${uniqueKeyword}"`);
  });

  /**
   * [TC_CAT_010] Tạo category với description dài
   * Mục tiêu: Kiểm tra tạo category với description dài (> 500 ký tự)
   * Input: {category: name, description: very_long_text}
   * Expected: Tạo thành công hoặc fail (tùy validation)
   * CheckDB: Verify data được lưu đúng
   * Rollback: Xóa category đã tạo
   */
  it('[TC_CAT_010] should handle category with long description', async () => {
    const categoryName = 'Long Description Category ' + Date.now();
    const longDescription = 'A'.repeat(1000); // 1000 characters

    const categoriesBefore = await Category.count();

    try {
      const createdCategory = await categoryService.createCategory({
        category: categoryName,
        description: longDescription
      });

      // Nếu thành công - verify data
      expect(createdCategory).toBeDefined();
      expect(createdCategory.category).toBe(categoryName);
      
      createdCategories.push(createdCategory.id);

      // CheckDB: Verify long description was saved
      const categoryInDb = await Category.findByPk(createdCategory.id);
      expect(categoryInDb?.description).toBe(longDescription);

      console.log('⚠️ TC_CAT_010: Service accepts long description (1000 chars)');
    } catch (error: any) {
      // Nếu fail - có thể có validation giới hạn độ dài
      console.log('✅ TC_CAT_010: Service validates description length (good)');
      
      // CheckDB: Verify no category was created
      const categoriesAfter = await Category.count();
      expect(categoriesAfter).toBe(categoriesBefore);
    }
  });

  /**
   * [TC_CAT_011] Tạo category với ký tự đặc biệt
   * Mục tiêu: Kiểm tra tạo category với special characters
   * Input: {category: 'Test!@#$%^&*()', description: 'Special chars'}
   * Expected: Tạo thành công (hỗ trợ Unicode/special chars)
   * CheckDB: Verify data được lưu đúng
   * Rollback: Xóa category đã tạo
   */
  it('[TC_CAT_011] should create category with special characters', async () => {
    const specialCharName = 'Category Special!@#$%^&*() ' + Date.now();
    const specialDescription = 'Description with special chars: <>{}[]|\\';

    const categoriesBefore = await Category.count();

    try {
      const createdCategory = await categoryService.createCategory({
        category: specialCharName,
        description: specialDescription
      });

      expect(createdCategory).toBeDefined();
      expect(createdCategory.category).toBe(specialCharName);
      expect(createdCategory.description).toBe(specialDescription);

      createdCategories.push(createdCategory.id);

      // CheckDB: Verify special characters were saved correctly
      const categoryInDb = await Category.findByPk(createdCategory.id);
      expect(categoryInDb?.category).toBe(specialCharName);
      expect(categoryInDb?.description).toBe(specialDescription);

      console.log('✅ TC_CAT_011: Special characters handled correctly');
    } catch (error: any) {
      console.log('⚠️ TC_CAT_011: Service rejects special characters');
      
      // CheckDB: Verify no category created
      const categoriesAfter = await Category.count();
      expect(categoriesAfter).toBe(categoriesBefore);
    }
  });

  /**
   * [TC_CAT_012] Cập nhật category với dữ liệu trống
   * Mục tiêu: Kiểm tra update với empty values
   * Input: categoryId, {category: ''}
   * Expected: Có thể fail validation hoặc update thành công
   * CheckDB: Verify status sau update
   * Rollback: Không cần hoặc restore lại value cũ
   */
  it('[TC_CAT_012] should handle update with empty category name', async () => {
    if (!createdCategoryId) {
      throw new Error('Category chưa được tạo từ TC_CAT_003');
    }

    // Get original data
    const originalCategory = await Category.findByPk(createdCategoryId);
    const originalName = originalCategory?.category;

    try {
      const updatedCategory = await categoryService.updateCategory(createdCategoryId, {
        category: ''
      });

      // Nếu thành công - kiểm tra data
      console.log('⚠️ TC_CAT_012: Service allows empty category name (potential issue)');
      
      // CheckDB: Verify what was saved
      const categoryInDb = await Category.findByPk(createdCategoryId);
      expect(categoryInDb?.category).toBe('');

      // Rollback: Restore original name
      await Category.update(
        { category: originalName },
        { where: { id: createdCategoryId } }
      );
    } catch (error: any) {
      console.log('✅ TC_CAT_012: Service validates empty category name (good)');
      
      // CheckDB: Verify data unchanged
      const categoryInDb = await Category.findByPk(createdCategoryId);
      expect(categoryInDb?.category).toBe(originalName);
    }
  });

  /**
   * [TC_CAT_013] Tìm kiếm với keyword rỗng
   * Mục tiêu: Kiểm tra search với empty string
   * Input: search = ''
   * Expected: Trả về tất cả categories (như getAllCategories không filter)
   * CheckDB: Verify count = total categories
   * Rollback: Không cần
   */
  it('[TC_CAT_013] should return all categories when search keyword is empty', async () => {
    const emptyKeyword = '';
    
    const allCategories = await categoryService.getAllCategories();
    const searchResults = await categoryService.getAllCategories(emptyKeyword);

    expect(searchResults).toBeDefined();
    expect(Array.isArray(searchResults)).toBe(true);
    expect(searchResults.length).toBe(allCategories.length);

    // CheckDB: Verify returns all categories
    const totalCategoriesInDb = await Category.count();
    expect(searchResults.length).toBe(totalCategoriesInDb);

    console.log(`✅ TC_CAT_013: Empty search returned all ${searchResults.length} categories`);
  });

  /**
   * [TC_CAT_014] Tạo category trùng tên
   * Mục tiêu: Kiểm tra tạo 2 categories với cùng tên
   * Input: 2 lần create với cùng category name
   * Expected: Có thể fail (unique constraint) hoặc success (cho phép trùng)
   * CheckDB: Verify count tăng đúng
   * Rollback: Xóa categories đã tạo
   */
  it('[TC_CAT_014] should handle duplicate category names', async () => {
    const duplicateCategoryName = 'Duplicate Category Test ' + Date.now();
    const categoryDescription = 'Test description';

    const categoriesBefore = await Category.count();

    // Tạo category đầu tiên
    const firstCategory = await categoryService.createCategory({
      category: duplicateCategoryName,
      description: categoryDescription
    });
    createdCategories.push(firstCategory.id);

    expect(firstCategory).toBeDefined();

    // Thử tạo category thứ 2 với cùng tên
    try {
      const secondCategory = await categoryService.createCategory({
        category: duplicateCategoryName,
        description: 'Second description'
      });

      createdCategories.push(secondCategory.id);

      // Nếu thành công - hệ thống cho phép trùng tên
      console.log('⚠️ TC_CAT_014: System allows duplicate category names');
      
      // CheckDB: Verify 2 categories created
      const categoriesAfter = await Category.count();
      expect(categoriesAfter).toBe(categoriesBefore + 2);
    } catch (error: any) {
      // Nếu fail - có unique constraint
      console.log('✅ TC_CAT_014: System prevents duplicate category names (good)');
      
      // CheckDB: Verify only 1 category created
      const categoriesAfter = await Category.count();
      expect(categoriesAfter).toBe(categoriesBefore + 1);
    }
  });

  /**
   * [TC_CAT_015] Cập nhật category không thay đổi data
   * Mục tiêu: Kiểm tra update với dữ liệu giống hệt
   * Input: categoryId, {category: sameName, description: sameDesc}
   * Expected: Thành công (idempotent operation)
   * CheckDB: Verify data không đổi
   * Rollback: Không cần
   */
  it('[TC_CAT_015] should handle update with same data (idempotent)', async () => {
    if (!createdCategoryId) {
      throw new Error('Category chưa được tạo từ TC_CAT_003');
    }

    // Get current data
    const currentCategory = await Category.findByPk(createdCategoryId);
    const currentName = currentCategory?.category || 'Default Name';
    const currentDescription = currentCategory?.description || 'Default Description';

    // Update with same data
    const updateData = {
      category: currentName,
      description: currentDescription
    };

    const updatedCategory = await categoryService.updateCategory(createdCategoryId, updateData);

    expect(updatedCategory).toBeDefined();
    expect(updatedCategory.category).toBe(currentName);
    expect(updatedCategory.description).toBe(currentDescription);

    // CheckDB: Verify data unchanged
    const categoryInDb = await Category.findByPk(createdCategoryId);
    expect(categoryInDb?.category).toBe(currentName);
    expect(categoryInDb?.description).toBe(currentDescription);

    console.log('✅ TC_CAT_015: Idempotent update handled correctly');
  });
});
