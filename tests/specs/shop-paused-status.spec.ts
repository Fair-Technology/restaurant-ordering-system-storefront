import { test, expect, type Page } from '@playwright/test';

const ALL_DAY = [{ open: '00:00', close: '23:59' }];
const HOURS = { mon: ALL_DAY, tue: ALL_DAY, wed: ALL_DAY, thu: ALL_DAY, fri: ALL_DAY, sat: ALL_DAY, sun: ALL_DAY };
const CATALOG = {
  language: 'en',
  languages: ['en'],
  categories: [
    {
      id: 'c1', name: 'Pasta', sortOrder: 1,
      products: [
        { id: 'p1', name: 'Carbonara', price: 1050, images: [], variants: [], addons: [], isAvailable: true, additives: [], allergens: [], dietaryTags: [], spice: null },
      ],
    },
  ],
};

// Open by hours around the clock, so only ordersPaused can change what the page says
function shopWith(extra: Record<string, unknown>) {
  return {
    id: 'shop-t', slug: 'test-shop', name: 'Test Shop', currency: 'EUR', branding: null,
    timezone: 'Europe/Berlin', openingHours: HOURS, closures: [], ...extra,
  };
}

async function stub(page: Page, extra: Record<string, unknown>) {
  await page.route('**/api/shops/slug/test-shop', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(shopWith(extra)) }));
  await page.route('**/api/shops/shop-t/catalog**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CATALOG) }));
}

const MESSAGE = 'Back at 6pm, call us on 030 1234567';

test.describe('paused shop on the menu page', () => {
  test('status chip says "Ordering paused" instead of open', async ({ page }) => {
    await stub(page, { ordersPaused: true });
    await page.goto('/shops/test-shop');
    const intro = page.getByTestId('shop-intro');
    await expect(intro).toContainText('Ordering paused');
    await expect(intro).not.toContainText(/Open/);
  });

  test('banner stays after the explanatory popup is dismissed', async ({ page }) => {
    await stub(page, { ordersPaused: true, ordersPausedMessage: MESSAGE });
    await page.goto('/shops/test-shop');
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expect(page.getByTestId('paused-banner')).toContainText(MESSAGE);
    await page.getByRole('button', { name: 'OK' }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByTestId('paused-banner')).toBeVisible();
    await expect(page.getByTestId('paused-banner')).toContainText(MESSAGE);
  });

  test('the quick-add button is disabled', async ({ page }) => {
    await stub(page, { ordersPaused: true });
    await page.goto('/shops/test-shop');
    await page.getByRole('button', { name: 'OK' }).click();
    const add = page.getByRole('button', { name: /Add Carbonara/i });
    await expect(add).toBeDisabled();
    await expect(add).toHaveAttribute('aria-disabled', 'true');
  });

  test('the dish can still be opened, but its Add to order button is disabled', async ({ page }) => {
    await stub(page, { ordersPaused: true });
    await page.goto('/shops/test-shop');
    await page.getByRole('button', { name: 'OK' }).click();
    await page.getByRole('button', { name: /Carbonara/ }).filter({ hasNotText: /^Add/ }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Add to order/i })).toBeDisabled();
  });

  test('control: an unpaused shop still reads open and can add', async ({ page }) => {
    await stub(page, {});
    await page.goto('/shops/test-shop');
    await expect(page.getByTestId('shop-intro')).toContainText(/Open/);
    await expect(page.getByTestId('shop-intro')).not.toContainText('Ordering paused');
    await expect(page.getByTestId('paused-banner')).toHaveCount(0);
    const add = page.getByRole('button', { name: /Add Carbonara/i });
    await expect(add).toBeEnabled();
  });
});
