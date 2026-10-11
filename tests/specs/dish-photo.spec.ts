import { test, expect } from '@playwright/test';

test.use({ locale: 'en-US' });

const svg = (w: number, h: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="orange"/></svg>`;

test.beforeEach(async ({ page }) => {
  await page.route('https://dish.test/**', (r) =>
    r.fulfill({ status: 200, contentType: 'image/svg+xml', body: svg(1200, 900) }),
  );
  await page.route('**/api/shops/slug/test-shop', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'shop-t', slug: 'test-shop', name: 'Test Shop', currency: 'EUR', branding: null }),
    }),
  );
  await page.route('**/api/shops/shop-t/catalog**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        language: 'en',
        languages: ['en'],
        categories: [
          {
            id: 'c1',
            name: 'Mains',
            sortOrder: 1,
            products: [
              {
                id: 'p1',
                name: 'Pasta',
                price: 900,
                images: [{ url: 'https://dish.test/pasta.svg', sortOrder: 0 }],
                variants: [],
                addons: [],
                isAvailable: true,
                additives: [],
                allergens: [],
                dietaryTags: [],
                spice: null,
              },
            ],
          },
        ],
      }),
    }),
  );
});

test('a 1200 x 900 dish photo fills the 4:3 card box exactly (desktop)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/shops/test-shop');
  const button = page.getByRole('button', { name: 'View details for Pasta' });
  const img = button.locator('img');
  await expect(img).toHaveCSS('object-fit', 'cover');
  const box = await button.boundingBox();
  const imgBox = await img.boundingBox();
  expect(box?.width).toBeGreaterThan(200);
  expect((box?.width ?? 0) / (box?.height ?? 1)).toBeCloseTo(4 / 3, 2);
  expect(imgBox?.width).toBeCloseTo(box?.width ?? 0, 1);
  expect(imgBox?.height).toBeCloseTo(box?.height ?? 0, 1);
});

test('on a phone the card photo is a 108px square filled by the picture', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/shops/test-shop');
  const button = page.getByRole('button', { name: 'View details for Pasta' });
  const box = await button.boundingBox();
  const imgBox = await button.locator('img').boundingBox();
  expect(box?.width).toBe(108);
  expect(box?.height).toBe(108);
  expect(imgBox?.width).toBeCloseTo(108, 1);
  expect(imgBox?.height).toBeCloseTo(108, 1);
});

for (const [name, width, height] of [['desktop', 1280, 900], ['phone', 390, 800]] as const) {
  test(`the dish popup shows the photo at 4:3 (${name})`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/shops/test-shop');
    await page.getByRole('button', { name: 'View details for Pasta' }).click();
    const img = page.getByRole('dialog').locator('img[alt="Pasta"]');
    await expect(img).toBeVisible();
    await expect(img).toHaveCSS('object-fit', 'cover');
    const box = await img.boundingBox();
    expect(box?.width).toBeGreaterThan(300);
    expect((box?.width ?? 0) / (box?.height ?? 1)).toBeCloseTo(4 / 3, 2);
  });
}
