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

const svg = (w: number, h: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="red"/></svg>`;

test.describe('Cover image', () => {
  let requested: string[];

  test.beforeEach(async ({ page }) => {
    requested = [];
    await page.route('https://cover.test/**', (r) => r.abort());
    page.on('request', (r) => requested.push(r.url()));
  });

  test("shows the shop's cover when set, cropped to fill (object-fit cover, centred), with no blurred backdrop", async ({ page }) => {
    await mockShop(page, { heroImageUrl: 'https://cover.test/shops/shop-t/cover.jpg' });
    await page.goto('/shops/test-shop');
    const image = page.getByTestId('shop-hero-image');
    await expect(image).toHaveAttribute('src', 'https://cover.test/shops/shop-t/cover.jpg');
    await expect(image).toHaveCSS('object-fit', 'cover');
    await expect(image).toHaveCSS('object-position', '50% 50%');
    await expect(page.getByTestId('shop-hero-backdrop')).toHaveCount(0);
  });

  test('shows the bundled default when no cover is set', async ({ page }) => {
    await mockShop(page, null);
    await page.goto('/shops/test-shop');
    await expect(page.getByTestId('shop-hero-image')).toHaveAttribute('src', /default-cover/);
    await page.waitForLoadState('networkidle');
    expect(requested.some((u) => u.includes('images.unsplash.com'))).toBe(false);
  });

  test('shows no banner at all when the shop switched it off, even with a picture uploaded', async ({ page }) => {
    await mockShop(page, { heroImageUrl: 'https://cover.test/shops/shop-t/cover.jpg', showHero: false });
    await page.goto('/shops/test-shop');
    await expect(page.getByText('Test Shop').first()).toBeVisible();
    await expect(page.getByTestId('shop-hero')).toHaveCount(0);
    await page.waitForLoadState('networkidle');
    expect(requested.some((u) => u.includes('cover.test'))).toBe(false);
    await expect(page.locator('img[src*="default-cover"]')).toHaveCount(0);
  });

  test('shows no banner when switched off and no picture is uploaded (no default photo either)', async ({ page }) => {
    await mockShop(page, { heroImageUrl: null, showHero: false });
    await page.goto('/shops/test-shop');
    await expect(page.getByTestId('shop-hero')).toHaveCount(0);
  });

  test('shows the banner when the switch is on or was never set', async ({ page }) => {
    await mockShop(page, { heroImageUrl: 'https://cover.test/shops/shop-t/cover.jpg', showHero: true });
    await page.goto('/shops/test-shop');
    await expect(page.getByTestId('shop-hero')).toHaveCount(1);
  });

  test('treats an empty cover URL as no cover', async ({ page }) => {
    await mockShop(page, { heroImageUrl: '' });
    await page.goto('/shops/test-shop');
    await expect(page.getByTestId('shop-hero-image')).toHaveAttribute('src', /default-cover/);
  });

  test('is a fixed 2:1 box across the full width on a phone, whatever the picture is (even a broken one)', async ({ page }) => {
    await mockShop(page, { heroImageUrl: 'https://cover.test/broken.jpg' });
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/shops/test-shop');
    const box = await page.getByTestId('shop-hero-frame').boundingBox();
    expect(box?.x).toBe(0);
    expect(box?.width).toBe(390);
    expect(box?.height).toBe(195);
  });

  test('is a fixed 3:1 box from sm up, as wide as the menu (max-w-7xl) and centred', async ({ page }) => {
    await mockShop(page, { heroImageUrl: 'https://cover.test/broken.jpg' });
    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto('/shops/test-shop');
    let box = await page.getByTestId('shop-hero-frame').boundingBox();
    expect(box?.width).toBe(768);
    expect(box?.height).toBe(256);

    await page.setViewportSize({ width: 1600, height: 900 });
    box = await page.getByTestId('shop-hero-frame').boundingBox();
    expect(box?.width).toBe(1280);
    expect(box?.height).toBeCloseTo(1280 / 3, 0);
    expect(box?.x).toBe(160);
  });

  test('switches from 2:1 to 3:1 at the sm breakpoint (640px)', async ({ page }) => {
    await mockShop(page, { heroImageUrl: 'https://cover.test/broken.jpg' });
    await page.setViewportSize({ width: 639, height: 900 });
    await page.goto('/shops/test-shop');
    const frame = page.getByTestId('shop-hero-frame');
    expect((await frame.boundingBox())?.height).toBeCloseTo(319.5, 0);
    await page.setViewportSize({ width: 640, height: 900 });
    expect((await frame.boundingBox())?.height).toBeCloseTo(640 / 3, 0);
  });

  test('an old differently shaped cover is cropped to fill the box, never changing its size', async ({ page }) => {
    for (const [w, h] of [[2400, 1000], [1000, 2000], [2400, 400]]) {
      await page.unroute('https://cover.test/**');
      await page.route('https://cover.test/**', (r) =>
        r.fulfill({ status: 200, contentType: 'image/svg+xml', body: svg(w, h) }),
      );
      await mockShop(page, { heroImageUrl: 'https://cover.test/pic.svg' });
      await page.setViewportSize({ width: 1600, height: 900 });
      await page.goto('/shops/test-shop');
      const image = page.getByTestId('shop-hero-image');
      await expect(image).toHaveCSS('object-fit', 'cover');
      const frame = await page.getByTestId('shop-hero-frame').boundingBox();
      const img = await image.boundingBox();
      expect(frame?.height).toBeCloseTo(1280 / 3, 0);
      expect(img?.width).toBeCloseTo(frame?.width ?? 0, 0);
      expect(img?.height).toBeCloseTo(frame?.height ?? 0, 0);
    }
  });

  test('the logo badge in the shop intro overlaps the banner bottom edge at 390, 768 and 1280 px', async ({ page }) => {
    await mockShop(page, { heroImageUrl: 'https://cover.test/broken.jpg' });
    for (const width of [390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/shops/test-shop');
      const hero = await page.getByTestId('shop-hero').boundingBox();
      const badge = await page.getByTestId('shop-intro').locator('div.rounded-full').first().boundingBox();
      const bannerBottom = (hero?.y ?? 0) + (hero?.height ?? 0);
      expect(badge?.y).toBeLessThan(bannerBottom);
      expect((badge?.y ?? 0) + (badge?.height ?? 0)).toBeGreaterThan(bannerBottom);
    }
  });

  test('the shop name keeps a clear gap below the banner at 390, 768 and 1280 px', async ({ page }) => {
    await mockShop(page, { heroImageUrl: 'https://cover.test/broken.jpg' });
    for (const width of [390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/shops/test-shop');
      const hero = await page.getByTestId('shop-hero').boundingBox();
      const name = await page.getByTestId('shop-intro').getByRole('heading', { level: 1 }).boundingBox();
      const gap = (name?.y ?? 0) - ((hero?.y ?? 0) + (hero?.height ?? 0));
      console.log(`name gap at ${width}px: ${gap.toFixed(1)}`);
      expect(gap).toBeGreaterThanOrEqual(14);
    }
  });
});
