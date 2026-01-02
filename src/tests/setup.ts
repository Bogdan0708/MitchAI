/**
 * Jest Test Setup
 *
 * Global test configuration and mocks
 */

// Mock environment variables
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.DATABASE_URL = 'postgresql://localhost:5433/hospitality_test';
process.env.REDIS_URL = 'redis://localhost:6380';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.STRIPE_SECRET_KEY = 'sk_test_mock';

// Mock PostgreSQL Pool
jest.mock('pg', () => {
  const mockPool = {
    query: jest.fn(),
    connect: jest.fn(() => ({
      query: jest.fn(),
      release: jest.fn(),
    })),
    end: jest.fn(),
  };
  return { Pool: jest.fn(() => mockPool) };
});

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    lrange: jest.fn(),
    rpush: jest.fn(),
  }));
});

// Global test utilities
export const createMockRequest = (overrides: Record<string, unknown> = {}) => ({
  headers: {},
  body: {},
  params: {},
  query: {},
  tenant: null,
  requestId: 'test-request-id',
  ...overrides,
});

export const createMockResponse = () => {
  const res: Record<string, unknown> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

export const createMockNext = () => jest.fn();

// Clean up after all tests
afterAll(async () => {
  // Close any open connections
  jest.clearAllMocks();
});
