import { test, expect, Page } from '@playwright/test';

// Helper to login before tests
async function login(page: Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'bogdan@mitchfromtransylvania.com');
  await page.fill('input[type="password"]', 'MitchDracula2026!');
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 15000 });
}

test.describe('Dashboard - Authenticated', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('dashboard loads and shows welcome message', async ({ page }) => {
    await expect(page.locator('text=Dashboard').or(page.locator('text=Welcome'))).toBeVisible();
  });

  test('sidebar navigation works', async ({ page }) => {
    // Check if navigation items exist
    await expect(page.locator('text=Menu').first()).toBeVisible();
    await expect(page.locator('text=Orders').first()).toBeVisible();
  });

  test('can navigate to menu page', async ({ page }) => {
    await page.click('text=Menu');
    await expect(page).toHaveURL(/menu/);
  });

  test('can navigate to orders page', async ({ page }) => {
    await page.click('text=Orders');
    await expect(page).toHaveURL(/orders/);
  });

  test('can navigate to settings page', async ({ page }) => {
    await page.click('text=Settings');
    await expect(page).toHaveURL(/settings/);
  });
});

test.describe('Menu Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/dashboard/menu');
  });

  test('menu page loads and shows items', async ({ page }) => {
    await expect(page.locator('text=Menu').first()).toBeVisible();
    // Should have menu items from Square sync
    await expect(page.locator('[data-testid="menu-item"]').or(page.locator('table tr'))).toBeVisible({ timeout: 10000 });
  });

  test('can search menu items', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]').or(page.locator('input[type="search"]'));
    if (await searchInput.isVisible()) {
      await searchInput.fill('Mici');
      await page.waitForTimeout(500); // Debounce
      await expect(page.locator('text=Mici')).toBeVisible();
    }
  });
});

test.describe('Order Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/dashboard/orders');
  });

  test('orders page loads', async ({ page }) => {
    await expect(page.locator('text=Orders').first()).toBeVisible();
  });

  test('can filter orders by status', async ({ page }) => {
    const statusFilter = page.locator('select').or(page.locator('[data-testid="status-filter"]'));
    if (await statusFilter.isVisible()) {
      await statusFilter.selectOption({ label: 'Completed' });
    }
  });
});

test.describe('AI Features', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('AI chat is accessible', async ({ page }) => {
    await page.goto('/dashboard/chat');
    await expect(page.locator('text=Chat').or(page.locator('text=AI Assistant'))).toBeVisible();
  });

  test('reviews page loads', async ({ page }) => {
    await page.goto('/dashboard/reviews');
    await expect(page.locator('text=Reviews').first()).toBeVisible();
  });
});
