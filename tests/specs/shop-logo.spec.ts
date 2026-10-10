import { test, expect, type Page } from '@playwright/test';

const svg = (w: number, h: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="teal"/></svg>`;

async function mockLogo(page: Page, w: number, h: number) {
  await page.route('https://logo.test/**', (r) =>
    r.fulfill({ status: 200, contentType: 'image/svg+xml', body: svg(w, h) }),
  );
}

async function mockShop(page: Page, name = 'Test Shop') {
  await page.route('**/api/shops/slug/test-shop', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'shop-t',
        slug: 'test-shop',
        name,
        branding: { logoUrl: 'https://logo.test/logo.svg' },
      }),
    }),
  );
  await page.route('**/api/shops/shop-t/catalog**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ categories: [] }),
    }),
  );
}

async function mockHome(page: Page) {
  await page.route('**/api/shops', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        shops: [
          {
            id: 'shop-t',
            name: 'Test Shop',
            slug: 'test-shop',
            branding: { logoUrl: 'https://logo.test/logo.svg' },
          },
        ],
      }),
    }),
  );
}

test.describe('Shop logo shows whole', () => {
  const navLogo = (page: Page) => page.locator('header img').first();
  const navBox = async (page: Page) => {
    await expect(navLogo(page)).toHaveJSProperty('complete', true);
    return navLogo(page).boundingBox();
  };

  test('a wide 4:1 logo is 48px tall on desktop, keeps its proportions, not cropped (nav bar)', async ({ page }) => {
    await mockLogo(page, 800, 200);
    await mockShop(page);
    await page.goto('/shops/test-shop');
    await expect(navLogo(page)).toHaveCSS('object-fit', 'contain');
    await expect.poll(async () => (await navBox(page))?.width).toBeCloseTo(192, 0);
    expect((await navBox(page))?.height).toBe(48);
  });

  test('a very wide logo is capped at 320px on desktop, 200px on a phone (nav bar)', async ({ page }) => {
    await mockLogo(page, 3000, 300);
    await mockShop(page);
    await page.goto('/shops/test-shop');
    await expect.poll(async () => (await navBox(page))?.width).toBe(320);
    expect((await navBox(page))?.height).toBe(48);
    await page.setViewportSize({ width: 390, height: 800 });
    await expect.poll(async () => (await navBox(page))?.width).toBe(200);
    expect((await navBox(page))?.height).toBe(40);
  });

  test('a square logo is 48px on desktop and 40px on a phone (nav bar)', async ({ page }) => {
    await mockLogo(page, 400, 400);
    await mockShop(page);
    await page.goto('/shops/test-shop');
    await expect(navLogo(page)).toHaveCSS('object-fit', 'contain');
    await expect.poll(async () => (await navBox(page))?.width).toBe(48);
    expect((await navBox(page))?.height).toBe(48);
    await page.setViewportSize({ width: 390, height: 800 });
    await expect.poll(async () => (await navBox(page))?.width).toBe(40);
    expect((await navBox(page))?.height).toBe(40);
  });

  test('a small logo is never scaled up past its natural size (nav bar)', async ({ page }) => {
    await mockLogo(page, 60, 15);
    await mockShop(page);
    await page.goto('/shops/test-shop');
    await expect.poll(async () => (await navBox(page))?.width).toBe(60);
    expect((await navBox(page))?.height).toBe(15);
  });

  test('the header stays 64px tall with a logo', async ({ page }) => {
    await mockLogo(page, 400, 400);
    await mockShop(page);
    await page.goto('/shops/test-shop');
    await expect(navLogo(page)).toBeVisible();
    expect((await page.locator('header').boundingBox())?.height).toBe(65); // h-16 + 1px border
  });

  test('on a 390px phone a wide logo leaves the shop name and cart on screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await mockLogo(page, 1000, 100);
    await mockShop(page, 'A Rather Long Restaurant Name');
    await page.goto('/shops/test-shop');
    await expect.poll(async () => (await navBox(page))?.width).toBe(200);
    const cart = await page.getByRole('button', { name: 'Cart' }).boundingBox();
    expect(cart!.x + cart!.width).toBeLessThanOrEqual(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test('a wide logo keeps its height and widens on the home list', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await mockLogo(page, 400, 100);
    await mockHome(page);
    await page.goto('/');
    const logo = page.locator('[data-testid="shop-card"] img');
    await expect(logo).toHaveCSS('object-fit', 'contain');
    await expect.poll(async () => (await logo.boundingBox())?.width).toBeGreaterThan(64);
    const box = await logo.boundingBox();
    expect(box?.height).toBe(64);
    expect(box!.width).toBeLessThanOrEqual(256);
  });

  test('a square logo is unchanged on the home list', async ({ page }) => {
    await mockLogo(page, 200, 200);
    await mockHome(page);
    await page.goto('/');
    const box = await page.locator('[data-testid="shop-card"] img').boundingBox();
    expect(box?.width).toBe(64);
    expect(box?.height).toBe(64);
  });

  test('an uploaded logo is bare and replaces the shop name in the nav bar', async ({ page }) => {
    await mockLogo(page, 200, 200);
    await mockShop(page);
    await page.goto('/shops/test-shop');
    const logo = page.locator('header img[alt="Test Shop"]');
    await expect(logo).toBeVisible();
    await expect(page.locator('header').getByText('Test Shop', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Go to Test Shop' })).toBeVisible();
    await expect(logo).toHaveCSS('box-shadow', 'none');
    await expect(logo).toHaveCSS('border-top-width', '0px');
    await expect(logo).toHaveCSS('border-radius', '0px');
    await expect(logo).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  });

  test('a wide uploaded logo is bare too', async ({ page }) => {
    await mockLogo(page, 400, 100);
    await mockShop(page);
    await page.goto('/shops/test-shop');
    const logo = page.locator('header img[alt="Test Shop"]');
    await expect(logo).toHaveCSS('box-shadow', 'none');
    await expect(logo).toHaveCSS('border-radius', '0px');
    await expect(logo).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  });

  test('home list logo is bare but the card still shows the shop name', async ({ page }) => {
    await mockLogo(page, 400, 100);
    await mockHome(page);
    await page.goto('/');
    const logo = page.locator('[data-testid="shop-card"] img');
    await expect(logo).toHaveCSS('box-shadow', 'none');
    await expect(logo).toHaveCSS('border-radius', '0px');
    await expect(logo).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(page.getByTestId('shop-name')).toHaveText('Test Shop');
  });

  test('without a logo the nav bar shows initials and the shop name', async ({ page }) => {
    await page.route('**/api/shops/slug/test-shop', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'shop-t', slug: 'test-shop', name: 'Test Shop', branding: null }),
      }),
    );
    await page.route('**/api/shops/shop-t/catalog**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ categories: [] }) }),
    );
    await page.goto('/shops/test-shop');
    await expect(page.locator('header').getByRole('img', { name: 'Test Shop' })).toHaveText('TE');
    await expect(page.locator('header').getByText('Test Shop', { exact: true })).toBeVisible();
  });
});
