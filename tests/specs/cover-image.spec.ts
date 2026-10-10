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
    await expect(page.getByTestId('shop-hero-image')).toHaveAttribute(
      'src',
      'https://cover.test/shops/shop-t/cover.jpg',
    );
    await expect(page.getByTestId('shop-hero-backdrop')).toHaveAttribute(
      'style',
      /https:\/\/cover\.test\/shops\/shop-t\/cover\.jpg/,
    );
    await expect(page.getByTestId('shop-hero-image')).toHaveCSS('object-fit', 'contain');
  });

  test('shows the bundled default when no cover is set', async ({ page }) => {
    await mockShop(page, null);
    await page.goto('/shops/test-shop');
    const backdrop = page.getByTestId('shop-hero-backdrop');
    await expect(backdrop).toHaveAttribute('style', /default-cover/);
    await expect(page.getByTestId('shop-hero-image')).toHaveAttribute('src', /default-cover/);
    expect(await backdrop.getAttribute('style')).not.toContain('unsplash');
    await page.waitForLoadState('networkidle');
    expect(requested.some((u) => u.includes('images.unsplash.com'))).toBe(false);
  });

  test('treats an empty cover URL as no cover', async ({ page }) => {
    await mockShop(page, { heroImageUrl: '' });
    await page.goto('/shops/test-shop');
    await expect(page.getByTestId('shop-hero-image')).toHaveAttribute('src', /default-cover/);
  });

  test('keeps the hero box size on wide and narrow screens', async ({ page }) => {
    await mockShop(page, null);
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/shops/test-shop');
    const hero = page.getByTestId('shop-hero');
    expect((await hero.boundingBox())?.height).toBe(384);
    await page.setViewportSize({ width: 390, height: 800 });
    expect((await hero.boundingBox())?.height).toBe(288);
  });
});
