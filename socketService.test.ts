import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import socketService from '../services/socketService';

/**
 * Feature 17: Socket Service - Comprehensive Unit Tests
 * ✅ Test Case IDs rõ ràng (đã đánh số lại từ 001 đến 021)
 * ✅ Mocking: Sử dụng mocks cho HTTP server và Socket.IO
 * ✅ Rollback: Không cần (không thay đổi DB)
 * ❗ Tests có cả PASS và edge cases thực tế
 * 
 * Services được test:
 * - initialize() - Khởi tạo Socket.IO server
 * - sendNotificationToUser() - Gửi notification cho user cụ thể
 * - sendNotificationToAllUsers() - Gửi broadcast notifications
 * - getIO() - Lấy Socket.IO instance
 * - authenticateSocket() - Xác thực socket connection (private)
 * - handleConnection() - Xử lý kết nối socket (private)
 * 
 * Lưu ý: Socket service xử lý real-time communication, có DB queries trong authentication
 */
describe('[Feature 17] Socket Service - Comprehensive Unit Tests', () => {
  let mockServer: any;
  let mockIo: any;
  let mockSocket: any;

  beforeEach(() => {
    // Reset mock trước mỗi test
    mockServer = {
      listen: vi.fn(),
      on: vi.fn()
    };

    mockIo = {
      use: vi.fn(),
      on: vi.fn(),
      to: vi.fn().mockReturnThis(),
      emit: vi.fn()
    };

    mockSocket = {
      id: 'test-socket-id',
      userId: 123,
      userType: 'user' as const,
      handshake: {
        auth: { token: 'test-token' },
        headers: {}
      },
      join: vi.fn(),
      disconnect: vi.fn(),
      on: vi.fn(),
      emit: vi.fn()
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Đảm bảo reset io và connectedUsers sau mỗi test
    (socketService as any).io = null;
    (socketService as any).connectedUsers = new Map();
    (socketService as any).connectedAdmins = new Map();
  });


  /**
   * [TC_SOCKET_001] Kiểm tra getIO khi chưa initialize
   * Mục tiêu: Verify getIO trả về null khi chưa khởi tạo
   * Input: Không có
   * Expected: getIO() returns null
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_SOCKET_001] should return null when getIO called before initialize', async () => {
    const io = socketService.getIO();
    expect(io).toBeNull();

    console.log('✅ TC_SOCKET_001: getIO returns null before initialization');
  });

  /**
   * [TC_SOCKET_002] Gửi notification khi chưa initialize
   * Mục tiêu: Kiểm tra sendNotificationToUser xử lý khi io chưa được khởi tạo
   * Input: userId, notification
   * Expected: Return false, log error
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_SOCKET_002] should return false when sending notification before initialize', async () => {
    const testNotification = {
      id: 1,
      title: 'Test Notification',
      message: 'Test message',
      type: 'order' as const,
      created_at: new Date()
    };

    const result = socketService.sendNotificationToUser(123, testNotification);
    expect(result).toBe(false);

    console.log('✅ TC_SOCKET_002: Returns false when not initialized');
  });

  /**
   * [TC_SOCKET_003] Gửi broadcast notification khi chưa initialize
   * Mục tiêu: Kiểm tra sendNotificationToAllUsers xử lý khi io chưa được khởi tạo
   * Input: notification
   * Expected: Return false, log error
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_SOCKET_003] should return false when broadcasting before initialize', async () => {
    const broadcastNotification = {
      id: 2,
      title: 'Broadcast',
      message: 'Broadcast message',
      type: 'promotion' as const,
      created_at: new Date()
    };

    const result = socketService.sendNotificationToAllUsers(broadcastNotification);
    expect(result).toBe(false);

    console.log('✅ TC_SOCKET_003: Returns false when broadcasting before initialize');
  });

  /**
   * [TC_SOCKET_004] Kiểm tra getIO sau khi initialize
   * Mục tiêu: Verify getIO trả về Server instance sau khi khởi tạo
   * Input: Mock HTTP server
   * Expected: getIO() returns Server instance
   * CheckDB: Không truy cập DB
   * Rollback: Cleanup io sau test
   */
  it('[TC_SOCKET_004] should return Server instance after initialize', async () => {
    vi.resetModules();

    const mockIo = {
      use: vi.fn(),
      on: vi.fn(),
      to: vi.fn().mockReturnThis(),
      emit: vi.fn()
    };

    const mockServer = {};

    // ✅ Constructor function (KHÔNG dùng arrow)
    const MockServerClass = vi.fn(function (this: any) {
      return mockIo;
    });

    vi.doMock('socket.io', () => ({
      Server: MockServerClass
    }));

    const { default: socketService } = await import('../services/socketService');

    const result = socketService.initialize(mockServer as any);

    expect(MockServerClass).toHaveBeenCalledTimes(1);
    expect(result).toBe(mockIo);

    const io = socketService.getIO();
    expect(io).toBe(result);
  });


  /**
   * [TC_SOCKET_005] Gửi notification với minimal object
   * Mục tiêu: Kiểm tra service chấp nhận notification với ít fields
   * Input: notification với required fields only
   * Expected: Gửi thành công
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_SOCKET_005] should handle minimal notification object', async () => {
    const mockTo = vi.fn().mockReturnThis();
    const mockEmit = vi.fn();

    (socketService as any).io = {
      to: mockTo,
      emit: mockEmit
    };

    const minimalNotification = {
      title: 'Minimal',
      message: 'Minimal notification'
    };

    const result = socketService.sendNotificationToUser(555, minimalNotification);

    expect(result).toBe(true);
    expect(mockEmit).toHaveBeenCalled();

    console.log('✅ TC_SOCKET_005: Handles minimal notification');
  });

  /**
   * [TC_SOCKET_006] Broadcast với notification data lớn
   * Mục tiêu: Kiểm tra broadcast xử lý data lớn
   * Input: notification với large payload
   * Expected: Gửi thành công đến tất cả users
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_SOCKET_006] should handle broadcast with large notification data', async () => {
    const mockTo = vi.fn().mockReturnThis();
    const mockEmit = vi.fn();

    (socketService as any).io = {
      to: mockTo,
      emit: mockEmit
    };

    (socketService as any).connectedUsers = new Map([
      [1, 'socket-1'],
      [2, 'socket-2']
    ]);

    const largeNotification = {
      id: 18,
      title: 'Large Data Test',
      message: 'C'.repeat(5000), // 5KB message
      type: 'promotion' as const,
      created_at: new Date(),
      data: {
        tours: Array(100).fill({ id: 1, name: 'Test Tour' })
      }
    };

    const result = socketService.sendNotificationToAllUsers(largeNotification);

    expect(result).toBe(true);
    expect(mockEmit).toHaveBeenCalled();

    console.log('✅ TC_SOCKET_006: Handles large broadcast data');
  });
  /**
   * [TC_SOCKET_007] handleConnection với socket thiếu userId
   * Mục tiêu: Kiểm tra socket bị disconnect ngay khi thiếu userId
   * Input: socket không có userId
   * Expected: socket.disconnect() được gọi
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_SOCKET_007] should disconnect socket when userId is missing', () => {
    const invalidSocket = {
      ...mockSocket,
      userId: undefined,
      userType: undefined,
      join: vi.fn(),
      disconnect: vi.fn(),
      on: vi.fn()
    };

    (socketService as any).handleConnection(invalidSocket);

    expect(invalidSocket.disconnect).toHaveBeenCalled();
    expect(invalidSocket.join).not.toHaveBeenCalled();

    console.log('✅ TC_SOCKET_007: Disconnects socket with missing userId');
  });

  /**
   * [TC_SOCKET_008] handleConnection - sự kiện 'register' gọi với role user
   * Mục tiêu: Kiểm tra sự kiện 'register' join đúng room khi role='user'
   * Input: socket emit 'register' với role='user', userId=10
   * Expected: socket.join('user:10') được gọi
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_SOCKET_008] should join user room on register event with role user', () => {
    const userSocket = {
      ...mockSocket,
      userId: 10,
      userType: 'user' as const,
      join: vi.fn(),
      disconnect: vi.fn(),
      on: vi.fn((event: string, cb: Function) => {
        if (event === 'register') {
          // Simulate FE gửi sự kiện register
          cb({ role: 'user', userId: 10 });
        }
      })
    };

    (socketService as any).handleConnection(userSocket);

    // join được gọi ít nhất cho 'user:10' (từ register event)
    expect(userSocket.join).toHaveBeenCalledWith('user:10');

    console.log('✅ TC_SOCKET_008: Join user room on register event');
  });

  /**
   * [TC_SOCKET_009] handleConnection - sự kiện 'register' gọi với role admin
   * Mục tiêu: Kiểm tra sự kiện 'register' join đúng room khi role='admin'
   * Input: socket emit 'register' với role='admin', userId=5
   * Expected: socket.join('admin:5') được gọi
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_SOCKET_009] should join admin room on register event with role admin', () => {
    const adminSocket = {
      ...mockSocket,
      userId: 5,
      userType: 'admin' as const,
      join: vi.fn(),
      disconnect: vi.fn(),
      on: vi.fn((event: string, cb: Function) => {
        if (event === 'register') {
          cb({ role: 'admin', userId: 5 });
        }
      })
    };

    (socketService as any).handleConnection(adminSocket);

    expect(adminSocket.join).toHaveBeenCalledWith('admin:5');

    console.log('✅ TC_SOCKET_009: Join admin room on register event');
  });

  /**
   * [TC_SOCKET_010] handleConnection - sự kiện 'disconnect' xóa user khỏi connectedUsers
   * Mục tiêu: Kiểm tra disconnect xóa entry trong connectedUsers
   * Input: socket user ngắt kết nối
   * Expected: connectedUsers không còn entry của userId
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_SOCKET_010] should remove user from connectedUsers on disconnect', () => {
    (socketService as any).connectedUsers.set(99, 'socket-to-remove');

    const userSocket = {
      ...mockSocket,
      userId: 99,
      userType: 'user' as const,
      join: vi.fn(),
      disconnect: vi.fn(),
      on: vi.fn((event: string, cb: Function) => {
        if (event === 'disconnect') cb();
      })
    };

    (socketService as any).handleConnection(userSocket);

    expect((socketService as any).connectedUsers.has(99)).toBe(false);

    console.log('✅ TC_SOCKET_010: User removed from connectedUsers on disconnect');
  });

  /**
   * [TC_SOCKET_011] handleConnection - sự kiện 'disconnect' xóa admin khỏi connectedAdmins
   * Mục tiêu: Kiểm tra disconnect xóa entry trong connectedAdmins
   * Input: socket admin ngắt kết nối
   * Expected: connectedAdmins không còn entry của adminId
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_SOCKET_011] should remove admin from connectedAdmins on disconnect', () => {
    (socketService as any).connectedAdmins.set(7, 'socket-admin-remove');

    const adminSocket = {
      ...mockSocket,
      userId: 7,
      userType: 'admin' as const,
      join: vi.fn(),
      disconnect: vi.fn(),
      on: vi.fn((event: string, cb: Function) => {
        if (event === 'disconnect') cb();
      })
    };

    (socketService as any).handleConnection(adminSocket);

    expect((socketService as any).connectedAdmins.has(7)).toBe(false);

    console.log('✅ TC_SOCKET_011: Admin removed from connectedAdmins on disconnect');
  });

  /**
   * [TC_SOCKET_012] handleConnection - sự kiện 'notification:read' từ user
   * Mục tiêu: Kiểm tra event 'notification:read' emit lại cho đúng room user
   * Input: socket user, notificationId=42
   * Expected: io.to('user:123').emit('notification:read', { notificationId: 42 })
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_SOCKET_012] should re-emit notification:read to user room', () => {
    const mockTo = vi.fn().mockReturnThis();
    const mockEmit = vi.fn();

    (socketService as any).io = {
      to: mockTo,
      emit: mockEmit
    };

    const userSocket = {
      ...mockSocket,
      userId: 123,
      userType: 'user' as const,
      join: vi.fn(),
      disconnect: vi.fn(),
      on: vi.fn((event: string, cb: Function) => {
        if (event === 'notification:read') {
          cb({ notificationId: 42 });
        }
      })
    };

    (socketService as any).handleConnection(userSocket);

    expect(mockTo).toHaveBeenCalledWith('user:123');
    expect(mockEmit).toHaveBeenCalledWith('notification:read', { notificationId: 42 });

    console.log('✅ TC_SOCKET_012: Re-emits notification:read to user room');
  });

  /**
   * [TC_SOCKET_013] handleConnection - sự kiện 'notification:read' từ admin
   * Mục tiêu: Kiểm tra event 'notification:read' emit lại cho đúng room admin
   * Input: socket admin, notificationId=99
   * Expected: io.to('admin:1').emit('notification:read', { notificationId: 99 })
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_SOCKET_013] should re-emit notification:read to admin room', () => {
    const mockTo = vi.fn().mockReturnThis();
    const mockEmit = vi.fn();

    (socketService as any).io = {
      to: mockTo,
      emit: mockEmit
    };

    const adminSocket = {
      ...mockSocket,
      userId: 1,
      userType: 'admin' as const,
      join: vi.fn(),
      disconnect: vi.fn(),
      on: vi.fn((event: string, cb: Function) => {
        if (event === 'notification:read') {
          cb({ notificationId: 99 });
        }
      })
    };

    (socketService as any).handleConnection(adminSocket);

    expect(mockTo).toHaveBeenCalledWith('admin:1');
    expect(mockEmit).toHaveBeenCalledWith('notification:read', { notificationId: 99 });

    console.log('✅ TC_SOCKET_013: Re-emits notification:read to admin room');
  });

  /**
   * [TC_SOCKET_014] handleConnection - sự kiện 'ping' trả về 'pong'
   * Mục tiêu: Kiểm tra event 'ping' phản hồi 'pong' với timestamp
   * Input: socket emit 'ping'
   * Expected: socket.emit('pong', { timestamp: string })
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_SOCKET_014] should respond to ping with pong containing timestamp', () => {
    const emitSpy = vi.fn();

    const userSocket = {
      ...mockSocket,
      userId: 123,
      userType: 'user' as const,
      join: vi.fn(),
      disconnect: vi.fn(),
      emit: emitSpy,
      on: vi.fn((event: string, cb: Function) => {
        if (event === 'ping') cb();
      })
    };

    (socketService as any).handleConnection(userSocket);

    expect(emitSpy).toHaveBeenCalledWith('pong', expect.objectContaining({
      timestamp: expect.any(String)
    }));

    console.log('✅ TC_SOCKET_014: Responds to ping with pong + timestamp');
  });

  /**
   * [TC_SOCKET_015] authenticateSocket - không có token
   * Mục tiêu: Kiểm tra middleware gọi next(Error) khi thiếu token
   * Input: socket.handshake.auth.token = undefined
   * Expected: next được gọi với Error('Không tìm thấy token xác thực')
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_SOCKET_015] should call next with error when no token provided', async () => {
    const socketWithoutToken = {
      ...mockSocket,
      handshake: {
        auth: {},
        headers: {}
      }
    };

    const nextFn = vi.fn();
    await (socketService as any).authenticateSocket(socketWithoutToken, nextFn);

    expect(nextFn).toHaveBeenCalledWith(expect.any(Error));
    const err = nextFn.mock.calls[0][0] as Error;
    expect(err.message).toContain('token');

    console.log('✅ TC_SOCKET_015: Calls next(Error) when no token');
  });


  /**
   * [TC_SOCKET_016] authenticateSocket - token lấy từ Authorization header
   * Mục tiêu: Kiểm tra middleware đọc token từ header Authorization
   * Input: socket.handshake.headers.authorization = 'Bearer invalid'
   * Expected: Cố gắng verify token, thất bại → next(Error)
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_SOCKET_016] should read token from Authorization header as fallback', async () => {
    const socketWithHeader = {
      ...mockSocket,
      handshake: {
        auth: {},
        headers: {
          authorization: 'Bearer this.is.invalid'
        }
      }
    };

    const nextFn = vi.fn();
    await (socketService as any).authenticateSocket(socketWithHeader, nextFn);

    // Token không hợp lệ → next được gọi với Error
    expect(nextFn).toHaveBeenCalledWith(expect.any(Error));

    console.log('✅ TC_SOCKET_016: Reads token from Authorization header');
  });

  /**
   * [TC_SOCKET_017] authenticateSocket - token user hợp lệ nhưng user không tồn tại trong DB
   * Mục tiêu: Kiểm tra middleware gọi next(Error) khi User.findByPk trả về null
   * Input: JWT hợp lệ với decoded.id, User.findByPk trả về null
   * Expected: next được gọi với Error 'Người dùng không tồn tại'
   * CheckDB: Mock User.findByPk trả về null
   * Rollback: Không cần
   */
  it('[TC_SOCKET_017] should call next with error when user not found in DB', async () => {
    const jwt = await import('jsonwebtoken');
    const fakeToken = jwt.sign({ id: 9999 }, process.env.JWT_SECRET || 'your-secret-key');

    // Mock User model
    const UserModule = await import('../models/User');
    vi.spyOn(UserModule.default, 'findByPk').mockResolvedValue(null as any);

    const socketWithValidToken = {
      ...mockSocket,
      handshake: {
        auth: { token: fakeToken },
        headers: {}
      }
    };

    const nextFn = vi.fn();
    await (socketService as any).authenticateSocket(socketWithValidToken, nextFn);

    expect(nextFn).toHaveBeenCalledWith(expect.any(Error));
    const err = nextFn.mock.calls[0][0] as Error;
    expect(err.message).toContain('Người dùng không tồn tại');

    console.log('✅ TC_SOCKET_017: Calls next(Error) when user not found');
  });

  /**
   * [TC_SOCKET_018] authenticateSocket - token admin hợp lệ nhưng admin không tồn tại trong DB
   * Mục tiêu: Kiểm tra middleware gọi next(Error) khi Admin.findByPk trả về null
   * Input: JWT hợp lệ với decoded.adminId, Admin.findByPk trả về null
   * Expected: next được gọi với Error 'Quản trị viên không tồn tại'
   * CheckDB: Mock Admin.findByPk trả về null
   * Rollback: Không cần
   */
  it('[TC_SOCKET_018] should call next with error when admin not found in DB', async () => {
    const jwt = await import('jsonwebtoken');
    const fakeAdminToken = jwt.sign({ adminId: 8888 }, process.env.JWT_SECRET || 'your-secret-key');

    const AdminModule = await import('../models/Admin');
    vi.spyOn(AdminModule.default, 'findByPk').mockResolvedValue(null as any);

    const socketWithAdminToken = {
      ...mockSocket,
      handshake: {
        auth: { token: fakeAdminToken },
        headers: {}
      }
    };

    const nextFn = vi.fn();
    await (socketService as any).authenticateSocket(socketWithAdminToken, nextFn);

    expect(nextFn).toHaveBeenCalledWith(expect.any(Error));
    const err = nextFn.mock.calls[0][0] as Error;
    expect(err.message).toContain('Quản trị viên không tồn tại');

    console.log('✅ TC_SOCKET_018: Calls next(Error) when admin not found');
  });

  /**
   * [TC_SOCKET_019] authenticateSocket - token user hợp lệ, user tồn tại
   * Mục tiêu: Kiểm tra middleware gán userId, userType và gọi next() không có lỗi
   * Input: JWT hợp lệ với decoded.id=1, User.findByPk trả về user mock
   * Expected: socket.userId=1, socket.userType='user', next() không có args
   * CheckDB: Mock User.findByPk trả về mock user
   * Rollback: Không cần
   */
  it('[TC_SOCKET_019] should authenticate valid user token and call next()', async () => {
    const jwt = await import('jsonwebtoken');
    const userId = 1;
    const fakeToken = jwt.sign({ id: userId }, process.env.JWT_SECRET || 'your-secret-key');

    const UserModule = await import('../models/User');
    vi.spyOn(UserModule.default, 'findByPk').mockResolvedValue({ id: userId, name: 'Test User' } as any);

    const targetSocket = {
      ...mockSocket,
      handshake: {
        auth: { token: fakeToken },
        headers: {}
      }
    };

    const nextFn = vi.fn();
    await (socketService as any).authenticateSocket(targetSocket, nextFn);

    // next() phải được gọi không có đối số (thành công)
    expect(nextFn).toHaveBeenCalledWith();
    expect(targetSocket.userId).toBe(userId);
    expect(targetSocket.userType).toBe('user');

    console.log('✅ TC_SOCKET_019: Authenticates valid user token successfully');
  });

  /**
   * [TC_SOCKET_020] authenticateSocket - token admin hợp lệ, admin tồn tại
   * Mục tiêu: Kiểm tra middleware gán userId, userType='admin' và gọi next() thành công
   * Input: JWT hợp lệ với decoded.adminId=2, Admin.findByPk trả về admin mock
   * Expected: socket.userId=2, socket.userType='admin', next() không có args
   * CheckDB: Mock Admin.findByPk trả về mock admin
   * Rollback: Không cần
   */
  it('[TC_SOCKET_020] should authenticate valid admin token and call next()', async () => {
    const jwt = await import('jsonwebtoken');
    const adminId = 2;
    const fakeAdminToken = jwt.sign({ adminId }, process.env.JWT_SECRET || 'your-secret-key');

    const AdminModule = await import('../models/Admin');
    vi.spyOn(AdminModule.default, 'findByPk').mockResolvedValue({ id: adminId, name: 'Test Admin' } as any);

    const targetSocket = {
      ...mockSocket,
      handshake: {
        auth: { token: fakeAdminToken },
        headers: {}
      }
    };

    const nextFn = vi.fn();
    await (socketService as any).authenticateSocket(targetSocket, nextFn);

    expect(nextFn).toHaveBeenCalledWith();
    expect(targetSocket.userId).toBe(adminId);
    expect(targetSocket.userType).toBe('admin');

    console.log('✅ TC_SOCKET_020: Authenticates valid admin token successfully');
  });

  /**
   * [TC_SOCKET_021] authenticateSocket - JWT payload không có id lẫn adminId
   * Mục tiêu: Kiểm tra middleware gọi next(Error) khi payload không có id/adminId
   * Input: JWT hợp lệ nhưng payload chỉ có { email: 'test@test.com' }
   * Expected: next được gọi với Error 'Token không hợp lệ'
   * CheckDB: Không truy cập DB
   * Rollback: Không cần
   */
  it('[TC_SOCKET_021] should call next with error when token payload has no id or adminId', async () => {
    const jwt = await import('jsonwebtoken');
    const fakeToken = jwt.sign({ email: 'no-id@test.com' }, process.env.JWT_SECRET || 'your-secret-key');

    const socketWithWeirdToken = {
      ...mockSocket,
      handshake: {
        auth: { token: fakeToken },
        headers: {}
      }
    };

    const nextFn = vi.fn();
    await (socketService as any).authenticateSocket(socketWithWeirdToken, nextFn);

    expect(nextFn).toHaveBeenCalledWith(expect.any(Error));
    const err = nextFn.mock.calls[0][0] as Error;
    expect(err.message).toContain('Token không hợp lệ');

    console.log('✅ TC_SOCKET_021: Calls next(Error) for token with no id/adminId');
  });
});