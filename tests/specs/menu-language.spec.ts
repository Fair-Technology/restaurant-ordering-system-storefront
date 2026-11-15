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

// The catalog is fetched on mount and on a language switch only, so a quiet window is enough to prove
// that a failed switch settles instead of retrying on its own.
async function expectNoMoreCatalogRequests(requested: string[], quietMs = 750) {
  const seen = requested.length;
  await new Promise((resolve) => setTimeout(resolve, quietMs));
  expect(requested.length, 'the failed language switch must settle without another catalog request').toBe(seen);
}

test.use({ locale: 'en-US' });

test.describe('Menu language', () => {
  test('shows a spinner while the dishes are still loading, then the dishes', async ({ page }) => {
    await mockShop(page);
    let release: () => void = () => {};
    const held = new Promise<void>((r) => (release = r));
    await page.route('**/api/shops/shop-t/catalog**', async (route) => {
      await held;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EN_CATALOG) });
    });
    await page.goto('/shops/test-shop');

    await expect(page.getByTestId('shop-intro')).toBeVisible();
    await expect(page.getByTestId('menu-loading')).toBeVisible();
    await expect(page.getByTestId('menu-loading')).toHaveText('Loading…');

    release();
    await expect(page.getByRole('heading', { name: 'Margherita Pizza' })).toBeVisible();
    await expect(page.getByTestId('menu-loading')).toHaveCount(0);
  });

  test('switches the menu language', async ({ page }) => {
    await mockShop(page);
    await mockCatalog(page);
    await page.goto('/shops/test-shop');

    await expect(page.getByRole('heading', { name: 'Margherita Pizza' })).toBeVisible();
    await page.getByRole('button', { name: 'DE', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Pizza Margherita' })).toBeVisible();
  });

  test('a failed language switch shows a retryable menu error and does not keep the old-language dishes', async ({ page }) => {
    await mockShop(page);
    const requested: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/shops/shop-t/catalog')) {
        requested.push(new URL(request.url()).searchParams.get('lang') ?? '');
      }
    });
    await page.route('**/api/shops/shop-t/catalog**', async (route) => {
      const lang = new URL(route.request().url()).searchParams.get('lang');
      if (lang === 'de') {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'boom' }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EN_CATALOG) });
    });
    await page.goto('/shops/test-shop');
    await expect(page.getByRole('heading', { name: 'Margherita Pizza' })).toBeVisible();

    await page.getByRole('button', { name: 'DE', exact: true }).click();

    // A retryable error replaces the menu instead of leaving the English dishes on screen
    await expect(page.locator('[data-testid="menu-error"]')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(1);
    await expect(page.getByRole('alert')).toHaveText(/Die Speisekarte konnte nicht geladen werden/);
    await expect(page.locator('[data-testid="menu-error-retry"]')).toBeVisible();
    await expect(page.locator('[data-testid="menu"]')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Margherita Pizza' })).toHaveCount(0);

    // One request per language: the failed switch settles instead of retrying on its own
    expect(requested).toEqual(['en', 'de']);
    await expectNoMoreCatalogRequests(requested);

    // Switching back recovers from the cached English menu
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Margherita Pizza' })).toBeVisible();
    await expect(page.locator('[data-testid="menu"]')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.locator('[data-testid="menu-error"]')).toHaveCount(0);
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
