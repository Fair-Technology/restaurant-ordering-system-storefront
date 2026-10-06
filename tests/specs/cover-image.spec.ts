import { test, expect, type Page } from '@playwright/test';

async function mockShop(page: Page, branding: Record<string, unknown> | null) {
  await page.route('**/api/shops/slug/test-shop', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'shop-t',
        slug: 'test-shop',
        name: 'Test Shop',
        branding,
      }),
    });
  });
  await page.route('**/api/shops/shop-t/catalog**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ categories: [] }),
    });
  });
}

test.describe('Cover image', () => {
  let requested: string[];

  test.beforeEach(async ({ page }) => {
    requested = [];
    await page.route('https://cover.test/**', (r) => r.abort());
    page.on('request', (r) => requested.push(r.url()));
  });

  test("shows the shop's cover when set", async ({ page }) => {
    await mockShop(page, { heroImageUrl: 'https://cover.test/shops/shop-t/cover.jpg' });
    await page.goto('/shops/test-shop');
    await expect(page.getByTestId('shop-hero')).toHaveAttribute(
      'style',
      /https:\/\/cover\.test\/shops\/shop-t\/cover\.jpg/,
    );
  });

  test('shows the bundled default when no cover is set', async ({ page }) => {
    await mockShop(page, null);
    await page.goto('/shops/test-shop');
    const hero = page.getByTestId('shop-hero');
    await expect(hero).toHaveAttribute('style', /default-cover/);
    expect(await hero.getAttribute('style')).not.toContain('unsplash');
    await page.waitForLoadState('networkidle');
    expect(requested.some((u) => u.includes('images.unsplash.com'))).toBe(false);
  });

  test('treats an empty cover URL as no cover', async ({ page }) => {
    await mockShop(page, { heroImageUrl: '' });
    await page.goto('/shops/test-shop');
    await expect(page.getByTestId('shop-hero')).toHaveAttribute('style', /default-cover/);
  });
});
