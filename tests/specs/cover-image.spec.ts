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

  test('uses the fixed heights until the picture loads, or if it fails', async ({ page }) => {
    await mockShop(page, { heroImageUrl: 'https://cover.test/broken.jpg' });
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/shops/test-shop');
    const hero = page.getByTestId('shop-hero');
    expect((await hero.boundingBox())?.height).toBe(384);
    await page.setViewportSize({ width: 390, height: 800 });
    expect((await hero.boundingBox())?.height).toBe(288);
  });

  const svg = (w: number, h: number) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="red"/></svg>`;

  const heightFor = async (page: Page, w: number, h: number, viewportWidth: number) => {
    await page.unroute('https://cover.test/**');
    await page.route('https://cover.test/**', (r) =>
      r.fulfill({ status: 200, contentType: 'image/svg+xml', body: svg(w, h) }),
    );
    await mockShop(page, { heroImageUrl: 'https://cover.test/pic.svg' });
    await page.setViewportSize({ width: viewportWidth, height: 900 });
    await page.goto('/shops/test-shop');
    const hero = page.getByTestId('shop-hero');
    await expect(hero).toHaveAttribute('style', /aspect-ratio/);
    return (await hero.boundingBox())?.height ?? 0;
  };

  test('box follows a 2.4:1 picture on a phone', async ({ page }) => {
    expect(await heightFor(page, 2400, 1000, 390)).toBeCloseTo(162.5, 0);
  });

  test('on desktop the box matches the content width and follows the picture', async ({ page }) => {
    await heightFor(page, 2400, 1000, 1600);
    const box = await page.getByTestId('shop-hero').boundingBox();
    expect(box?.width).toBe(1232); // max-w-7xl (1280) minus px-6 on both sides
    expect(box?.height).toBeCloseTo(1232 / 2.4, 0);
  });

  test('on desktop a tall portrait picture is capped at 70vh', async ({ page }) => {
    expect(await heightFor(page, 1000, 2000, 1600)).toBe(630);
  });

  test('a very wide 6:1 picture gets the 160px minimum on a phone', async ({ page }) => {
    expect(await heightFor(page, 2400, 400, 390)).toBe(160);
  });
});
