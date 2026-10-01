import { test, expect } from '@playwright/test';
import { HomePage } from '../pages/HomePage.page';
import { mockShops, firstMockShop, secondMockShop } from '../fixtures/testData';

async function mockShopsApi(
  page: import('@playwright/test').Page,
  responseData = mockShops,
) {
  await page.route('**/api/shops', async (route) => {
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
    await page.route('**/api/shops', async (route) => {
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
