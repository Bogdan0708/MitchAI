import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import { AuthService } from '../../services/tenant/auth.service';

// Mock pg
jest.mock('pg', () => {
  const mPool = {
    query: jest.fn(),
  };
  return { Pool: jest.fn(() => mPool) };
});

// Mock bcrypt
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

// Mock tenant middleware for token generation
jest.mock('../../middleware/tenant.middleware', () => ({
  generateToken: jest.fn().mockReturnValue('mock-jwt-token'),
}));

describe('AuthService', () => {
  let pool: Pool;
  let authService: AuthService;
  const mockJwtSecret = 'test-secret';

  const mockUser = {
    id: 'user-123',
    tenant_id: 'tenant-456',
    email: 'test@example.com',
    password_hash: 'hashed-password',
    first_name: 'John',
    last_name: 'Doe',
    role: 'admin',
    tenant_slug: 'test-business',
    tenant_status: 'active',
    tenant_name: 'Test Business',
    tier_name: 'professional',
    locked_until: null,
    failed_login_attempts: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    pool = new Pool();
    authService = new AuthService(pool, mockJwtSecret);
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      // Setup mocks
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockUser] }) // User query
        .mockResolvedValueOnce({}); // Update last login

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.login(
        { email: 'test@example.com', password: 'password123' },
        '127.0.0.1'
      );

      expect(result).toHaveProperty('accessToken', 'mock-jwt-token');
      expect(result.user).toMatchObject({
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'admin',
      });
      expect(result.tenant).toMatchObject({
        id: 'tenant-456',
        slug: 'test-business',
        name: 'Test Business',
        tier: 'professional',
      });
    });

    it('should throw error for invalid credentials (user not found)', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(
        authService.login({ email: 'nonexistent@example.com', password: 'password' }, '127.0.0.1')
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for invalid password', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockUser] }) // User query
        .mockResolvedValueOnce({}); // Update failed attempts

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        authService.login({ email: 'test@example.com', password: 'wrongpassword' }, '127.0.0.1')
      ).rejects.toThrow('Invalid credentials');

      // Should increment failed login attempts
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    it('should throw error when account is locked', async () => {
      const lockedUser = {
        ...mockUser,
        locked_until: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes from now
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [lockedUser] });

      await expect(
        authService.login({ email: 'test@example.com', password: 'password' }, '127.0.0.1')
      ).rejects.toThrow(/Account locked until/);
    });

    it('should throw error when tenant is not active', async () => {
      const inactiveUser = {
        ...mockUser,
        tenant_status: 'suspended',
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [inactiveUser] });

      await expect(
        authService.login({ email: 'test@example.com', password: 'password' }, '127.0.0.1')
      ).rejects.toThrow('Tenant account is not active');
    });

    it('should allow login when tenant is in trial status', async () => {
      const trialUser = {
        ...mockUser,
        tenant_status: 'trial',
      };

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [trialUser] })
        .mockResolvedValueOnce({});

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.login(
        { email: 'test@example.com', password: 'password123' },
        '127.0.0.1'
      );

      expect(result).toHaveProperty('accessToken');
    });

    it('should reset failed login attempts on successful login', async () => {
      const userWithFailedAttempts = {
        ...mockUser,
        failed_login_attempts: 3,
      };

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [userWithFailedAttempts] })
        .mockResolvedValueOnce({});

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await authService.login(
        { email: 'test@example.com', password: 'password123' },
        '127.0.0.1'
      );

      // Verify the update query resets failed attempts
      expect(pool.query).toHaveBeenCalledTimes(2);
      const updateCall = (pool.query as jest.Mock).mock.calls[1];
      expect(updateCall[0]).toContain('failed_login_attempts = 0');
    });

    it('should track IP address on login', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockUser] })
        .mockResolvedValueOnce({});

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await authService.login(
        { email: 'test@example.com', password: 'password123' },
        '192.168.1.100'
      );

      // Verify IP is passed to update query
      const updateCall = (pool.query as jest.Mock).mock.calls[1];
      expect(updateCall[1]).toContain('192.168.1.100');
    });

    it('should use default tier when tier_name is null', async () => {
      const userWithoutTier = {
        ...mockUser,
        tier_name: null,
      };

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [userWithoutTier] })
        .mockResolvedValueOnce({});

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.login(
        { email: 'test@example.com', password: 'password123' },
        '127.0.0.1'
      );

      expect(result.tenant.tier).toBe('starter');
    });
  });
});
