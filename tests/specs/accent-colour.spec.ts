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
  await page.route('**/api/shops/shop-t/catalog', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ categories: [] }),
    });
  });
}

async function readAccentVars(page: Page) {
  const accent = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--brand-accent').trim(),
  );
  const onAccent = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--brand-on-accent').trim(),
  );
  return { accent, onAccent };
}

test.describe('Accent colour', () => {
  test('applies the shop accent', async ({ page }) => {
    await mockShop(page, { accentColor: '#E63946' });
    await page.goto('/shops/test-shop');

    await expect
      .poll(async () => (await readAccentVars(page)).accent)
      .toBe('#E63946');
    await expect
      .poll(async () => (await readAccentVars(page)).onAccent)
      .toBe('#000000');
  });

  test('falls back to the default accent', async ({ page }) => {
    await mockShop(page, null);
    await page.goto('/shops/test-shop');

    await expect
      .poll(async () => (await readAccentVars(page)).accent)
      .toBe('#C2410C');
    await expect
      .poll(async () => (await readAccentVars(page)).onAccent)
      .toBe('#FFFFFF');
  });
});
