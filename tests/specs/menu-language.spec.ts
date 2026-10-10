import { test, expect, type Page } from '@playwright/test';

const baseProduct = {
  id: 'p1',
  price: 1800,
  images: [] as unknown[],
  variants: [] as unknown[],
  addons: [] as unknown[],
  isAvailable: true,
  additives: [] as unknown[],
  spice: null,
  createdAt: '2026-09-25T00:00:00Z',
  updatedAt: '2026-09-25T00:00:00Z',
};

const EN_CATALOG = {
  language: 'en',
  languages: ['de', 'en'],
  categories: [
    {
      id: 'c1',
      name: 'Pizzas',
      sortOrder: 1,
      products: [
        {
          ...baseProduct,
          name: 'Margherita Pizza',
          description: 'Tomato, mozzarella, basil.',
          allergens: [
            { id: 'gluten', label: 'Cereals containing gluten' },
            { id: 'milk', label: 'Milk (including lactose)' },
          ],
          dietaryTags: [{ id: 'vegetarian', label: 'Vegetarian' }],
        },
      ],
    },
  ],
};

const DE_CATALOG = {
  language: 'de',
  languages: ['de', 'en'],
  categories: [
    {
      id: 'c1',
      name: 'Pizza',
      sortOrder: 1,
      products: [
        {
          ...baseProduct,
          name: 'Pizza Margherita',
          description: 'Tomate, Mozzarella, Basilikum.',
          allergens: [
            { id: 'gluten', label: 'Glutenhaltiges Getreide' },
            { id: 'milk', label: 'Milch (einschließlich Laktose)' },
          ],
          dietaryTags: [{ id: 'vegetarian', label: 'Vegetarisch' }],
        },
      ],
    },
  ],
};

async function mockShop(page: Page) {
  await page.route('**/api/shops/slug/test-shop', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'shop-t',
        slug: 'test-shop',
        name: 'Test Shop',
        branding: null,
      }),
    });
  });
}

async function mockCatalog(page: Page) {
  await page.route('**/api/shops/shop-t/catalog**', async (route) => {
    const lang = new URL(route.request().url()).searchParams.get('lang');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(lang === 'de' ? DE_CATALOG : EN_CATALOG),
    });
  });
}

test.use({ locale: 'en-US' });

test.describe('Menu language', () => {
  test('switches the menu language', async ({ page }) => {
    await mockShop(page);
    await mockCatalog(page);
    await page.goto('/shops/test-shop');

    await expect(page.getByRole('heading', { name: 'Margherita Pizza' })).toBeVisible();
    await page.getByRole('button', { name: 'DE', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Pizza Margherita' })).toBeVisible();
  });

  test('shows allergens in the dish details', async ({ page }) => {
    await mockShop(page);
    await mockCatalog(page);
    await page.goto('/shops/test-shop');

    await page.getByRole('button', { name: 'View details for Margherita Pizza' }).click();
    await expect(
      page.getByText('Cereals containing gluten, Milk (including lactose)'),
    ).toBeVisible();
    await expect(page.getByText('No declarable additives')).toBeVisible();
  });

  test('a single-language menu still offers the page languages DE and EN', async ({ page }) => {
    await mockShop(page);
    await page.route('**/api/shops/shop-t/catalog**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...DE_CATALOG, languages: ['de'] }),
      });
    });
    await page.goto('/shops/test-shop');

    await expect(page.getByRole('group', { name: 'Menu language' }).getByRole('button')).toHaveText(['DE', 'EN']);
    await expect(page.getByRole('heading', { name: 'Pizza Margherita' })).toBeVisible();
  });
});
