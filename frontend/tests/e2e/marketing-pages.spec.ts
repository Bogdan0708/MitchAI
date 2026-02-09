import { test, expect } from '@playwright/test';

test.describe('Marketing Pages', () => {
  test('homepage loads and has correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Mitch/);
    await expect(page.locator('text=AI-Powered Restaurant Management')).toBeVisible();
  });

  test('features page loads correctly', async ({ page }) => {
    await page.goto('/features');
    await expect(page.locator('h1')).toContainText('Everything you need');
    await expect(page.locator('text=AI Review Responses')).toBeVisible();
    await expect(page.locator('text=Smart Menu Enhancement')).toBeVisible();
  });

  test('pricing page shows all tiers', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.locator('h1')).toContainText('Simple, transparent pricing');
    await expect(page.locator('text=Starter')).toBeVisible();
    await expect(page.locator('text=Professional')).toBeVisible();
    await expect(page.locator('text=Enterprise')).toBeVisible();
    // Check prices are in GBP
    await expect(page.locator('text=£49')).toBeVisible();
    await expect(page.locator('text=£149')).toBeVisible();
  });

  test('about page shows team section', async ({ page }) => {
    await page.goto('/about');
    await expect(page.locator('h1')).toContainText('Built by hospitality people');
    await expect(page.locator('text=Bogdan Godja')).toBeVisible();
    await expect(page.locator('text=Ava Manghi')).toBeVisible();
  });

  test('contact page has form and contact info', async ({ page }) => {
    await page.goto('/contact');
    await expect(page.locator('h1')).toContainText('Get in Touch');
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('textarea[name="message"]')).toBeVisible();
  });

  test('privacy policy page loads', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.locator('h1')).toContainText('Privacy Policy');
    await expect(page.locator('text=Information We Collect')).toBeVisible();
    await expect(page.locator('text=UK GDPR')).toBeVisible();
  });

  test('terms of service page loads', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.locator('h1')).toContainText('Terms of Service');
    await expect(page.locator('text=Agreement to Terms')).toBeVisible();
    await expect(page.locator('text=Subscription and Payment')).toBeVisible();
  });

  test('navigation links work correctly', async ({ page }) => {
    await page.goto('/');
    
    // Click Features link
    await page.click('text=Features');
    await expect(page).toHaveURL('/features');
    
    // Click Pricing link
    await page.click('text=Pricing');
    await expect(page).toHaveURL('/pricing');
    
    // Click About link
    await page.click('text=About');
    await expect(page).toHaveURL('/about');
  });
});
