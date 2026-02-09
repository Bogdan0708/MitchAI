import { test, expect } from '@playwright/test';

const API_URL = process.env.TEST_API_URL || 'https://api.mitchfromtransylvania.com';
const TEST_EMAIL = 'bogdan@mitchfromtransylvania.com';
const TEST_PASSWORD = 'MitchDracula2026!';

test.describe('API Health', () => {
  test('health endpoint returns healthy status', async ({ request }) => {
    const response = await request.get(`${API_URL}/health`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.status).toBe('healthy');
    expect(data.checks.database.status).toBe('healthy');
    expect(data.checks.redis.status).toBe('healthy');
  });
});

test.describe('Authentication API', () => {
  test('login returns token on success', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/v1/auth/login`, {
      headers: {
        'Origin': 'https://mitchfromtransylvania.com',
        'Content-Type': 'application/json',
      },
      data: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      },
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.token).toBeTruthy();
    expect(data.data.user.email).toBe(TEST_EMAIL);
  });

  test('login returns 401 for invalid credentials', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/v1/auth/login`, {
      headers: {
        'Origin': 'https://mitchfromtransylvania.com',
        'Content-Type': 'application/json',
      },
      data: {
        email: 'invalid@example.com',
        password: 'wrongpassword',
      },
    });
    
    expect(response.status()).toBe(401);
  });

  test('protected routes require authentication', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/v1/menu`, {
      headers: {
        'Origin': 'https://mitchfromtransylvania.com',
      },
    });
    
    expect(response.status()).toBe(401);
  });
});

test.describe('Menu API', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    const loginResponse = await request.post(`${API_URL}/api/v1/auth/login`, {
      headers: {
        'Origin': 'https://mitchfromtransylvania.com',
        'Content-Type': 'application/json',
      },
      data: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      },
    });
    const data = await loginResponse.json();
    token = data.data.token;
  });

  test('can fetch menu items', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/v1/menu`, {
      headers: {
        'Origin': 'https://mitchfromtransylvania.com',
        'Authorization': `Bearer ${token}`,
      },
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBe(true);
  });
});

test.describe('AI API', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    const loginResponse = await request.post(`${API_URL}/api/v1/auth/login`, {
      headers: {
        'Origin': 'https://mitchfromtransylvania.com',
        'Content-Type': 'application/json',
      },
      data: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      },
    });
    const data = await loginResponse.json();
    token = data.data.token;
  });

  test('AI chat returns response', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/v1/ai/chat`, {
      headers: {
        'Origin': 'https://mitchfromtransylvania.com',
        'Authorization': `Bearer ${token}`,
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json',
      },
      data: {
        messages: [{ role: 'user', content: 'What are your opening hours?' }],
        sessionId: 'test-session',
      },
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.response).toBeTruthy();
  });

  test('AI models endpoint returns available models', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/v1/ai/models`, {
      headers: {
        'Origin': 'https://mitchfromtransylvania.com',
        'Authorization': `Bearer ${token}`,
      },
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.models.length).toBeGreaterThan(0);
  });
});

test.describe('Square Integration API', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    const loginResponse = await request.post(`${API_URL}/api/v1/auth/login`, {
      headers: {
        'Origin': 'https://mitchfromtransylvania.com',
        'Content-Type': 'application/json',
      },
      data: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      },
    });
    const data = await loginResponse.json();
    token = data.data.token;
  });

  test('Square status shows connected', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/v1/integrations/square/status`, {
      headers: {
        'Origin': 'https://mitchfromtransylvania.com',
        'Authorization': `Bearer ${token}`,
      },
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.connected).toBe(true);
    expect(data.merchant).toBeDefined();
  });
});
