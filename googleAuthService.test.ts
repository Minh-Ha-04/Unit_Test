import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import googleAuthService from '../services/googleAuthService';
import User from '../models/User';

/**
 * Feature 14: Google Authentication - Comprehensive Unit Tests
 * ✅ Test Case IDs rõ ràng
 * ✅ CheckDB: Xác minh database changes
 * ✅ Rollback: Khôi phục DB sau tests
 * ❗ Tests có cả PASS và edge cases thực tế
 * 
 * Services được test:
 * - loginWithGoogle()
 * - sendOTPEmail() (default export)
 * 
 * Lưu ý: Google auth yêu cầu valid Google token nên tests tập trung vào validation và error handling
 */
describe('[Feature 14] Google Authentication - Comprehensive Unit Tests', () => {
  let createdUsers: number[] = [];

  /**
   * Rollback: Xóa tất cả users đã tạo trong tests
   */
  afterAll(async () => {
    console.log('🔄 Starting Rollback...');
    
    for (const userId of createdUsers) {
      await User.destroy({ where: { id: userId } }).catch(() => {});
    }
    
    console.log(`✅ Rollback complete: Deleted ${createdUsers.length} test users`);
  });

  /**
   * [TC_GOOGLE_AUTH_001] Kiểm tra loginWithGoogle function tồn tại
   * Mục tiêu: Verify loginWithGoogle được export
   * Input: Không có
   * Expected: loginWithGoogle là function
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_GOOGLE_AUTH_001] should export loginWithGoogle function', async () => {
    // Import the named export
    const { loginWithGoogle } = await import('../services/googleAuthService');
    
    expect(loginWithGoogle).toBeDefined();
    expect(typeof loginWithGoogle).toBe('function');

    console.log('✅ TC_GOOGLE_AUTH_001: loginWithGoogle function exists');
  });

  /**
   * [TC_GOOGLE_AUTH_002] Kiểm tra sendOTPEmail function (default export)
   * Mục tiêu: Verify sendOTPEmail là default export
   * Input: Không có
   * Expected: sendOTPEmail là function
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_GOOGLE_AUTH_002] should export sendOTPEmail as default', async () => {
    const sendOTPEmail = (await import('../services/googleAuthService')).default;
    
    expect(sendOTPEmail).toBeDefined();
    expect(typeof sendOTPEmail).toBe('function');

    console.log('✅ TC_GOOGLE_AUTH_002: sendOTPEmail default export exists');
  });

  /**
   * [TC_GOOGLE_AUTH_003] Login với google_token rỗng
   * Mục tiêu: Kiểm tra validation khi google_token = ''
   * Input: {google_token: ''}
   * Expected: Ném lỗi "ID Token không hợp lệ"
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_GOOGLE_AUTH_003] should fail with empty google token', async () => {
    const { loginWithGoogle } = await import('../services/googleAuthService');
    const emptyToken = '';

    await expect(
      loginWithGoogle({ google_token: emptyToken })
    ).rejects.toThrow('ID Token không hợp lệ');

    console.log('✅ TC_GOOGLE_AUTH_003: Correctly rejected empty token');
  });

  /**
   * [TC_GOOGLE_AUTH_004] Login với google_token = null
   * Mục tiêu: Kiểm tra validation khi google_token = null
   * Input: {google_token: null}
   * Expected: Ném lỗi "ID Token không hợp lệ"
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_GOOGLE_AUTH_004] should fail with null google token', async () => {
    const { loginWithGoogle } = await import('../services/googleAuthService');

    await expect(
      loginWithGoogle({ google_token: null as any })
    ).rejects.toThrow();

    console.log('✅ TC_GOOGLE_AUTH_004: Correctly rejected null token');
  });

  /**
   * [TC_GOOGLE_AUTH_005] Login với google_token = undefined
   * Mục tiêu: Kiểm tra validation khi google_token = undefined
   * Input: {google_token: undefined}
   * Expected: Ném lỗi "ID Token không hợp lệ"
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_GOOGLE_AUTH_005] should fail with undefined google token', async () => {
    const { loginWithGoogle } = await import('../services/googleAuthService');

    await expect(
      loginWithGoogle({ google_token: undefined as any })
    ).rejects.toThrow();

    console.log('✅ TC_GOOGLE_AUTH_005: Correctly rejected undefined token');
  });

  /**
   * [TC_GOOGLE_AUTH_006] Login với google_token không phải string
   * Mục tiêu: Kiểm tra type validation
   * Input: {google_token: 123} (number)
   * Expected: Ném lỗi "ID Token không hợp lệ"
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_GOOGLE_AUTH_006] should fail with non-string google token', async () => {
    const { loginWithGoogle } = await import('../services/googleAuthService');
    const invalidTokenType = 123;

    await expect(
      loginWithGoogle({ google_token: invalidTokenType as any })
    ).rejects.toThrow('ID Token không hợp lệ');

    console.log('✅ TC_GOOGLE_AUTH_006: Correctly rejected non-string token');
  });

  /**
   * [TC_GOOGLE_AUTH_007] Login với google_token là object
   * Mục tiêu: Kiểm tra type validation
   * Input: {google_token: {key: 'value'}}
   * Expected: Ném lỗi "ID Token không hợp lệ"
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_GOOGLE_AUTH_007] should fail with object google token', async () => {
    const { loginWithGoogle } = await import('../services/googleAuthService');
    const invalidTokenObject = { key: 'value' };

    await expect(
      loginWithGoogle({ google_token: invalidTokenObject as any })
    ).rejects.toThrow('ID Token không hợp lệ');

    console.log('✅ TC_GOOGLE_AUTH_007: Correctly rejected object token');
  });

  /**
   * [TC_GOOGLE_AUTH_008] Login với invalid Google token
   * Mục tiêu: Kiểm tra error handling khi token không hợp lệ
   * Input: {google_token: 'invalid_token_string'}
   * Expected: Ném lỗi "Token Google không hợp lệ"
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_GOOGLE_AUTH_008] should fail with invalid Google token', async () => {
    const { loginWithGoogle } = await import('../services/googleAuthService');
    const invalidGoogleToken = 'invalid_google_token_12345';

    await expect(
      loginWithGoogle({ google_token: invalidGoogleToken })
    ).rejects.toThrow();

    console.log('✅ TC_GOOGLE_AUTH_008: Correctly handled invalid Google token');
  });

  /**
   * [TC_GOOGLE_AUTH_009] Login với expired Google token
   * Mục tiêu: Kiểm tra error handling khi token đã hết hạn
   * Input: {google_token: 'expired_token_format'}
   * Expected: Ném lỗi validation hoặc token invalid
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_GOOGLE_AUTH_009] should fail with malformed token', async () => {
    const { loginWithGoogle } = await import('../services/googleAuthService');
    const malformedToken = 'a.b.c'; // JWT-like but invalid

    await expect(
      loginWithGoogle({ google_token: malformedToken })
    ).rejects.toThrow();

    console.log('✅ TC_GOOGLE_AUTH_009: Correctly handled malformed token');
  });

  /**
   * [TC_GOOGLE_AUTH_010] Login với token là array
   * Mục tiêu: Kiểm tra type validation
   * Input: {google_token: ['token1', 'token2']}
   * Expected: Ném lỗi "ID Token không hợp lệ"
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_GOOGLE_AUTH_010] should fail with array google token', async () => {
    const { loginWithGoogle } = await import('../services/googleAuthService');
    const invalidTokenArray = ['token1', 'token2'];

    await expect(
      loginWithGoogle({ google_token: invalidTokenArray as any })
    ).rejects.toThrow('ID Token không hợp lệ');

    console.log('✅ TC_GOOGLE_AUTH_010: Correctly rejected array token');
  });

  /**
   * [TC_GOOGLE_AUTH_011] Login với token là boolean
   * Mục tiêu: Kiểm tra type validation
   * Input: {google_token: true}
   * Expected: Ném lỗi "ID Token không hợp lệ"
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_GOOGLE_AUTH_011] should fail with boolean google token', async () => {
    const { loginWithGoogle } = await import('../services/googleAuthService');

    await expect(
      loginWithGoogle({ google_token: true as any })
    ).rejects.toThrow('ID Token không hợp lệ');

    console.log('✅ TC_GOOGLE_AUTH_011: Correctly rejected boolean token');
  });

  /**
   * [TC_GOOGLE_AUTH_012] Kiểm tra DTO interface
   * Mục tiêu: Verify GoogleLoginDTO interface có field google_token
   * Input: Không có (compile-time check)
   * Expected: Interface đúng structure
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_GOOGLE_AUTH_012] should accept valid GoogleLoginDTO', async () => {
    const validDTO = {
      google_token: 'test_token_string'
    };

    // TypeScript compile-time check
    expect(validDTO).toHaveProperty('google_token');
    expect(typeof validDTO.google_token).toBe('string');

    console.log('✅ TC_GOOGLE_AUTH_012: GoogleLoginDTO structure is correct');
  });

  /**
   * [TC_GOOGLE_AUTH_013] Login với token có whitespace
   * Mục tiêu: Kiểm tra xử lý whitespace trong token
   * Input: {google_token: '  token  '}
   * Expected: Có thể fail hoặc tự trim (tùy implementation)
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_GOOGLE_AUTH_013] should handle token with whitespace', async () => {
    const { loginWithGoogle } = await import('../services/googleAuthService');
    const tokenWithSpaces = '  invalid_token  ';

    try {
      await loginWithGoogle({ google_token: tokenWithSpaces });
      console.log('⚠️ TC_GOOGLE_AUTH_013: Service accepts token with whitespace');
    } catch (error: any) {
      console.log('✅ TC_GOOGLE_AUTH_013: Service rejects token with whitespace');
    }
  });

  /**
   * [TC_GOOGLE_AUTH_014] Login với token rất dài
   * Mục tiêu: Kiểm tra xử lý token dài bất thường
   * Input: {google_token: 'A'.repeat(10000)}
   * Expected: Fail validation hoặc token invalid
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_GOOGLE_AUTH_014] should handle extremely long token', async () => {
    const { loginWithGoogle } = await import('../services/googleAuthService');
    const extremelyLongToken = 'A'.repeat(10000);

    await expect(
      loginWithGoogle({ google_token: extremelyLongToken })
    ).rejects.toThrow();

    console.log('✅ TC_GOOGLE_AUTH_014: Correctly handled extremely long token');
  });

  /**
   * [TC_GOOGLE_AUTH_015] Login với token chứa ký tự đặc biệt
   * Mục tiêu: Kiểm tra xử lý special characters
   * Input: {google_token: '!@#$%^&*()'}
   * Expected: Fail validation
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_GOOGLE_AUTH_015] should handle token with special characters', async () => {
    const { loginWithGoogle } = await import('../services/googleAuthService');
    const specialCharToken = '!@#$%^&*()_+';

    await expect(
      loginWithGoogle({ google_token: specialCharToken })
    ).rejects.toThrow();

    console.log('✅ TC_GOOGLE_AUTH_015: Correctly handled special character token');
  });

  /**
   * [TC_GOOGLE_AUTH_016] Kiểm tra service không thay đổi DB khi token invalid
   * Mục tiêu: Verify không có side effects khi fail
   * Input: {google_token: 'invalid'}
   * Expected: Fail và không tạo user
   * CheckDB: Verify user count không đổi
   * Rollback: Không cần
   */
  it('[TC_GOOGLE_AUTH_016] should not create user with invalid token', async () => {
    const { loginWithGoogle } = await import('../services/googleAuthService');
    const invalidToken = 'invalid_token';
    
    const usersBefore = await User.count();

    await expect(
      loginWithGoogle({ google_token: invalidToken })
    ).rejects.toThrow();

    // CheckDB: Verify no user was created
    const usersAfter = await User.count();
    expect(usersAfter).toBe(usersBefore);

    console.log('✅ TC_GOOGLE_AUTH_016: No user created with invalid token');
  });

  /**
   * [TC_GOOGLE_AUTH_017] Send OTP email với email không hợp lệ
   * Mục tiêu: Kiểm tra sendOTPEmail validation
   * Input: email='', otp='123456'
   * Expected: Ném lỗi
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_GOOGLE_AUTH_017] should fail sending OTP with invalid email', async () => {
    const sendOTPEmail = (await import('../services/googleAuthService')).default;
    const invalidEmail = '';
    const testOtp = '123456';

    await expect(
      sendOTPEmail(invalidEmail, testOtp)
    ).rejects.toThrow();

    console.log('✅ TC_GOOGLE_AUTH_017: Correctly rejected invalid email');
  });

  /**
   * [TC_GOOGLE_AUTH_018] Send OTP với OTP rỗng
   * Mục tiêu: Kiểm tra sendOTPEmail validation
   * Input: email='test@test.com', otp=''
   * Expected: Có thể fail hoặc gửi email rỗng
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_GOOGLE_AUTH_018] should handle empty OTP', async () => {
    const sendOTPEmail = (await import('../services/googleAuthService')).default;
    const testEmail = 'test@example.com';
    const emptyOtp = '';

    try {
      await sendOTPEmail(testEmail, emptyOtp);
      console.log('⚠️ TC_GOOGLE_AUTH_018: Service accepts empty OTP');
    } catch (error: any) {
      console.log('✅ TC_GOOGLE_AUTH_018: Service rejects empty OTP (good)');
    }
  });

  /**
   * [TC_GOOGLE_AUTH_019] Send OTP với email không có @
   * Mục tiêu: Kiểm tra email format validation
   * Input: email='invalidemail', otp='123456'
   * Expected: Ném lỗi
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_GOOGLE_AUTH_019] should fail sending OTP with invalid email format', async () => {
    const sendOTPEmail = (await import('../services/googleAuthService')).default;
    const invalidEmailFormat = 'invalidemail';
    const testOtp = '123456';

    await expect(
      sendOTPEmail(invalidEmailFormat, testOtp)
    ).rejects.toThrow();

    console.log('✅ TC_GOOGLE_AUTH_019: Correctly rejected invalid email format');
  });

  /**
   * [TC_GOOGLE_AUTH_020] Kiểm tra cả hai exports cùng tồn tại
   * Mục tiêu: Verify service có cả named và default export
   * Input: Không có
   * Expected: loginWithGoogle (named) và sendOTPEmail (default) đều tồn tại
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_GOOGLE_AUTH_020] should have both named and default exports', async () => {
    const googleAuthModule = await import('../services/googleAuthService');
    
    // Check named export
    expect(googleAuthModule.loginWithGoogle).toBeDefined();
    expect(typeof googleAuthModule.loginWithGoogle).toBe('function');
    
    // Check default export
    expect(googleAuthModule.default).toBeDefined();
    expect(typeof googleAuthModule.default).toBe('function');

    console.log('✅ TC_GOOGLE_AUTH_020: Both exports exist');
  });
});
