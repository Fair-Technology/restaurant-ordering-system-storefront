import { test, expect, type Page } from '@playwright/test';

/**
 * Regression: double-clicking "Add to order" must not click through the closing product modal.
 *
 * The button both adds the item and closes the modal, which unmounts immediately. The second
 * click of a double-click then lands on whatever is underneath — on a phone the mobile cart bar
 * (navigating to checkout), on larger screens the next dish card (opening a different product).
 *
 * `ProductModal`/`ComboModal` arm a short capture-phase click guard on `document` for the window
 * right after a close (see src/hooks/useDismissClickGuard.ts); these tests pin that behaviour.
 */

// A menu long enough to fill the grid behind the centred md+ dialog.
const DISH = (i: number) => ({
  id: `p${i}`,
  name: `Lasagne ${i}`,
  description: 'Pasta sheets, sauce and cheese.',
  price: 1000 + i,
  images: [] as unknown[],
  variants: [] as unknown[],
  addons: [] as unknown[],
  isAvailable: true,
  additives: [] as unknown[],
  allergens: [] as unknown[],
  dietaryTags: [] as unknown[],
  spice: null,
});
const PRODUCTS = Array.from({ length: 12 }, (_, i) => DISH(i + 1));
// A combo whose groups each offer exactly one dish: ready to add the moment it opens.
const COMBO = {
  ...DISH(90),
  id: 'm1',
  name: 'Pasta Menu',
  price: 1200,
  combo: {
    groups: [
      { id: 'g-main', name: 'Main', productIds: ['p1'] },
      { id: 'g-drink', name: 'Drink', productIds: ['p2'] },
    ],
  },
};
const MENU = [COMBO, ...PRODUCTS];

function fulfil(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

async function mockMenu(page: Page) {
  await page.route('**/api/shops/slug/test-shop', (route) =>
    route.fulfill(
      fulfil({
        id: 'shop-t',
        slug: 'test-shop',
        name: 'Test Shop',
        currency: 'EUR',
        countryCode: 'DE',
        timezone: 'Europe/Berlin',
        fulfilment: { modes: ['collection'], prepMinutes: { collection: 20, delivery: 45, dine_in: 20 }, delivery: null },
        orderLimitReached: false,
        branding: null,
      }),
    ),
  );
  await page.route('**/api/shops/shop-t/catalog**', (route) =>
    route.fulfill(
      fulfil({
        language: 'en',
        languages: ['en'],
        categories: [{ id: 'c1', name: 'Lasagne', sortOrder: 1, products: MENU }],
      }),
    ),
  );
  await page.route('**/api/shops/slug/test-shop/legal**', (route) =>
    route.fulfill(
      fulfil({
        slug: 'test-shop',
        shopName: 'Test Shop',
        language: 'en',
        impressum: { lines: [{ label: 'Provider', value: 'Test Shop GmbH' }] },
        terms: { text: 'T'.repeat(60), revision: 1, updatedAt: 'x' },
        withdrawal: { text: 'W'.repeat(60), revision: 1, updatedAt: 'x' },
        privacyNotice: null,
        seller: { legalName: 'Test Shop GmbH', phone: '030 1234567' },
        platform: { name: 'Fair Technology', salesSiteUrl: null },
      }),
    ),
  );
}

const cartCount = (page: Page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem('mewmew_cart_v1:test-shop') || '[]').reduce(
      (n: number, i: { quantity?: number }) => n + (i.quantity ?? 0),
      0,
    ),
  );

/** Counts clicks that make it past `document` (i.e. to the page underneath the modal). */
async function countLeakedClicks(page: Page) {
  return page.evaluate(() => {
    (window as unknown as { __leaked: number }).__leaked = 0;
    document.body.addEventListener(
      'click',
      () => {
        const w = window as unknown as { __leaked: number };
        w.__leaked += 1;
      },
      true,
    );
  });
}
const leakedClicks = (page: Page) =>
  page.evaluate(() => (window as unknown as { __leaked: number }).__leaked);

async function openModal(page: Page, dish = 'Lasagne 1') {
  await page.getByText(dish).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

async function dblclickAdd(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: /add to order/i }).first().dblclick();
  await page.waitForTimeout(500);
}

test.describe('Add to order click-through', () => {
  test.use({ locale: 'en-US' });

  test('on a phone the second click does not fire the cart bar', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockMenu(page);
    await page.goto('/shops/test-shop');
    await expect(page.getByText('Lasagne 1').first()).toBeVisible();

    await openModal(page);
    await countLeakedClicks(page);
    await dblclickAdd(page);

    // one item added, modal closed, still on the menu — not pushed to checkout
    expect(await cartCount(page)).toBe(1);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).toHaveURL(/\/shops\/test-shop$/);
    await expect(page.getByText('Your order', { exact: true })).toHaveCount(0);
    // only the click that closed the modal reached the page; the stray one was swallowed
    expect(await leakedClicks(page)).toBe(1);
  });

  test('on a desktop the second click does not open another dish', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockMenu(page);
    await page.goto('/shops/test-shop');
    await expect(page.getByText('Lasagne 1').first()).toBeVisible();

    await openModal(page);
    await countLeakedClicks(page);
    await dblclickAdd(page);

    expect(await cartCount(page)).toBe(1);
    // no dialog at all — in particular not a different dish's
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // only the click that closed the modal reached the page; the stray one was swallowed
    expect(await leakedClicks(page)).toBe(1);
  });

  test('a combo does not click through either', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockMenu(page);
    await page.goto('/shops/test-shop');
    await expect(page.getByText('Pasta Menu').first()).toBeVisible();

    await page.getByText('Pasta Menu').first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const add = dialog.getByRole('button', { name: /add to order/i }).first();
    // every group has one dish, so the combo is ready straight away
    await expect(add).toHaveAttribute('aria-disabled', 'false');
    await add.dblclick();
    await page.waitForTimeout(500);

    expect(await cartCount(page)).toBe(1);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).toHaveURL(/\/shops\/test-shop$/);
  });
});
