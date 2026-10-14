import { test, expect } from '@playwright/test';
import { HomePage } from '../pages/HomePage.page';
import { mockShops, firstMockShop, secondMockShop } from '../fixtures/testData';

async function mockShopsApi(
  page: import('@playwright/test').Page,
  responseData = mockShops,
) {
  await page.route('**/api/shops/public', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(responseData),
    });
  });
}

test.describe('Home Page - Happy Path', () => {
  test.beforeEach(async ({ page }) => {
    await mockShopsApi(page);
    const homePage = new HomePage(page);
    await homePage.goto();
  });

  test('should display the page heading', async ({ page }) => {
    const homePage = new HomePage(page);
    await expect(homePage.heading).toBeVisible();
  });

  test('should show the correct number of shops cards', async ({ page }) => {
    const homePage = new HomePage(page);
    await expect(homePage.shopGrid).toBeVisible();
    const count = await homePage.getShopCount();
    expect(count).toBe(mockShops.shops.length);
  });

  test('should navigate to shop page when a card is clicked', async ({
    page,
  }) => {
    const homePage = new HomePage(page);
    await expect(homePage.shopGrid).toBeVisible();
    await homePage.clickShopByName(firstMockShop.name);
    await expect(page).toHaveURL(new RegExp(`/shops/${firstMockShop.slug}`));
  });
});

test.describe('Home Page - Error State', () => {
  test('should show error message when API fails', async ({ page }) => {
    await page.route('**/api/shops/public', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server error' }),
      });
    });

    const homePage = new HomePage(page);
    await homePage.goto();

    await expect(homePage.errorMessage).toBeVisible();
    await expect(homePage.shopGrid).not.toBeVisible();
  });
});

test.describe('Home Page — Empty State', () => {
  test('should show empty state when no shops exist', async ({ page }) => {
    await mockShopsApi(page, { shops: [] });

    const homePage = new HomePage(page);
    await homePage.goto();

    await expect(homePage.emptyState).toBeVisible();
    await expect(homePage.shopCards).toHaveCount(0);
  });
});

test.describe('Home Page - Shop without a logo', () => {
  test('shows the first two letters of the name instead of an image', async ({ page }) => {
    await mockShopsApi(page, {
      shops: [{ ...firstMockShop, name: 'Ma Pasta', slug: 'mapasta', branding: { logoUrl: null } }],
    } as typeof mockShops);
    const homePage = new HomePage(page);
    await homePage.goto();

    const logo = page.getByRole('img', { name: 'Ma Pasta' });
    await expect(logo).toHaveText('MA');
  });
});

test.describe('Home Page - Search', () => {
  test('typing filters the restaurants by name', async ({ page }) => {
    await mockShopsApi(page);
    await page.goto('/');
    await page.getByRole('searchbox').fill(firstMockShop.name!.slice(0, 5));
    await expect(page.getByTestId('shop-card')).toHaveCount(
      mockShops.shops.filter((s) => s.name?.toLowerCase().includes(firstMockShop.name!.slice(0, 5).toLowerCase())).length,
    );
    await page.getByRole('searchbox').fill('zzzz');
    await expect(page.getByTestId('shop-card')).toHaveCount(0);
    await expect(page.getByText('No restaurant matches “zzzz”.')).toBeVisible();
  });
});

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const ALL_DAY = Object.fromEntries(DAYS.map((d) => [d, [{ open: '00:00', close: '00:00' }]]));

test.describe('Home Page - Status pill', () => {
  test('a shop that paused orders says Ordering paused even while open', async ({ page }) => {
    await mockShopsApi(page, {
      shops: [{ ...firstMockShop, openingHours: ALL_DAY, ordersPaused: true }],
    } as typeof mockShops);
    await page.goto('/');
    const card = page.getByTestId('shop-card');
    await expect(card.getByText('Ordering paused')).toBeVisible();
    await expect(card.getByText('Open now')).toHaveCount(0);
  });

  test('an open shop taking orders says Open now', async ({ page }) => {
    await mockShopsApi(page, {
      shops: [{ ...firstMockShop, openingHours: ALL_DAY, ordersPaused: false }],
    } as typeof mockShops);
    await page.goto('/');
    await expect(page.getByTestId('shop-card').getByText('Open now')).toBeVisible();
  });

  test('the old isPaused flag no longer drives the pill', async ({ page }) => {
    await mockShopsApi(page, {
      shops: [{ ...firstMockShop, openingHours: ALL_DAY, ordersPaused: false, isPaused: true }],
    } as unknown as typeof mockShops);
    await page.goto('/');
    const card = page.getByTestId('shop-card');
    await expect(card.getByText('Open now')).toBeVisible();
    await expect(card.getByText('Ordering paused')).toHaveCount(0);
  });
});

test.describe('Home Page - Public list', () => {
  test('the home page reads the public list, not the superadmin-only list', async ({ page }) => {
    await page.route('**/api/shops', (route) =>
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Forbidden' }),
      }),
    );
    await mockShopsApi(page);
    const homePage = new HomePage(page);
    await homePage.goto();
    await expect(homePage.shopCards).toHaveCount(2);
    await expect(homePage.errorMessage).not.toBeVisible();
  });
});
