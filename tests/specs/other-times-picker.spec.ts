import { test, expect, type Page } from '@playwright/test';

/**
 * The "Other times" picker: choose a day and time, see the menu for that moment.
 * Every API call is mocked; the fake server answers relative to the real clock.
 */

const TZ = 'Europe/Berlin';
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dowIn = (days: number) =>
  DOW.indexOf(new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(new Date(Date.now() + days * 86_400_000)));

const product = (id: string, name: string, availableNow = true) => ({
  id, name, description: '', price: 1050, images: [], variants: [], addons: [], isAvailable: true,
  additives: [], allergens: [], dietaryTags: [], spice: null, unavailableModes: [], availableNow, combo: null,
});
const DAY = [{ open: '00:00', close: '23:59' }];
const allDay = { mon: DAY, tue: DAY, wed: DAY, thu: DAY, fri: DAY, sat: DAY, sun: DAY };
const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

function quarterSlots(): string[] {
  const start = Math.ceil((Date.now() + 15 * 60_000) / 900_000) * 900_000;
  return Array.from({ length: 96 * 3 }, (_, i) => new Date(start + i * 900_000).toISOString());
}

interface Fake { catalogAts: (string | null)[]; quoteBodies: any[] }

async function mock(page: Page, opts: { noSlots?: boolean } = {}): Promise<Fake> {
  const fake: Fake = { catalogAts: [], quoteBodies: [] };
  await page.route('**/api/shops/slug/test-shop', (route) =>
    route.fulfill(json({
      id: 'shop-t', slug: 'test-shop', name: 'Test Shop', currency: 'EUR', countryCode: 'DE', timezone: TZ,
      openingHours: allDay, closures: [], orderLimitReached: false, branding: null,
      fulfilment: { modes: ['collection'], prepMinutes: { collection: 20, delivery: 45, dine_in: 20 }, delivery: null },
    })));
  await page.route('**/api/shops/shop-t/catalog**', (route) => {
    const at = new URL(route.request().url()).searchParams.get('at');
    fake.catalogAts.push(at);
    const brunch = {
      id: 'c2', name: 'Brunch', sortOrder: 2, availableNow: !!at,
      schedule: { daysOfWeek: [dowIn(1)], startTime: '00:00', endTime: '23:59' },
      products: [product('p2', 'Pancakes', !!at)],
    };
    route.fulfill(json({
      language: 'en', languages: ['en'],
      categories: [{ id: 'c1', name: 'Pasta', sortOrder: 1, availableNow: true, schedule: null, products: [product('p1', 'Carbonara')] }, brunch],
      // served only on a day well beyond the 2-day window
      otherTimeDishes: [{
        id: 'd9', name: 'Sunday Roast', price: 1800,
        schedule: { startDate: '2020-01-01', endDate: null, daysOfWeek: [dowIn(5)], startTime: '12:00', endTime: '15:00' },
      }],
    }));
  });
  await page.route('**/api/shops/slug/test-shop/legal**', (route) =>
    route.fulfill(json({
      slug: 'test-shop', shopName: 'Test Shop', language: 'en',
      impressum: { lines: [{ label: 'Provider', value: 'Test Shop GmbH' }] },
      terms: { text: 'T'.repeat(60), revision: 1, updatedAt: 'x' },
      withdrawal: { text: 'W'.repeat(60), revision: 1, updatedAt: 'x' },
      privacyNotice: null, seller: { legalName: 'Test Shop GmbH', phone: '030 1234567' },
      platform: { name: 'Fair Technology', salesSiteUrl: null },
    })));
  await page.route('**/api/orders/quote', (route) => {
    const body = route.request().postDataJSON();
    fake.quoteBodies.push(body);
    const items: { productId: string }[] = body.items;
    if (items.length === 0) return route.fulfill(json({ error: 'items must be a non-empty array' }, 400));
    const at: string | undefined = body.scheduledFor;
    const hasLate = items.some((i) => i.productId === 'p4');
    const notNow = items.flatMap((i, index) => (i.productId === 'p2' ? [{ index, servedNow: false, servedLater: true }] : []));
    route.fulfill(json({
      currency: 'EUR', fulfilmentMode: 'collection', scheduleHorizonDays: 2,
      lines: items.map((i, index) => ({ index, productId: i.productId, name: i.productId, quantity: 1, status: 'ok', unitPriceCents: 500, expectedUnitPriceCents: 500, lineTotalCents: 500 })),
      subtotalCents: 500, taxCents: 30, minOrderAmountCents: 0, belowMinimum: false, openNow: true,
      paymentMethods: ['card'], addressRequired: false, prepMinutes: 20, orderLimitReached: false,
      slots: opts.noSlots ? [] : quarterSlots(), scheduledFor: at ?? null,
      slotAvailable: at ? !hasLate : null, servedNow: notNow.length === 0, timeLimited: at ? [] : notNow,
      acceptsCodes: false, discount: null, discountProblem: null, discountMinSubtotalCents: null, loyalty: null,
      deliveryFeeCents: null, totalCents: 500, postcodeServed: null,
    }));
  });
  return fake;
}

async function seedCart(page: Page, items: { id: string; name: string }[]) {
  await page.addInitScript((its) =>
    localStorage.setItem('cart_v1:test-shop', JSON.stringify(its.map((i) => ({ key: `${i.id}::::`, id: i.id, name: i.name, price: 500, quantity: 1 })))), items);
}

const dialog = (page: Page) => page.getByRole('dialog', { name: /other times|choose a day and time|not served then/i });

async function pickBrunch(page: Page) {
  await page.getByTestId('other-times-button').click();
  await page.getByRole('button', { name: /Brunch/ }).click();
  await expect(page.getByRole('heading', { name: 'Choose a day and time' })).toBeVisible();
  await page.getByRole('button', { name: 'Order for this time' }).click();
}

test.describe('Other times picker', () => {
  test.use({ locale: 'en-GB' });

  test('an entry beyond the booking window is listed with "Pre-order from" and cannot be tapped', async ({ page }) => {
    await mock(page);
    await page.goto('/shops/test-shop');
    await page.getByTestId('other-times-button').click();
    const d = dialog(page);
    await expect(d).toBeVisible();
    const roast = d.getByText('Sunday Roast');
    await expect(roast).toBeVisible();
    await expect(d.getByText(/^Pre-order from /)).toHaveCount(1);
    await expect(d.getByRole('button', { name: /Sunday Roast/ })).toHaveCount(0);
    // the entry inside the window is tappable
    await expect(d.getByRole('button', { name: /Brunch/ })).toBeVisible();
  });

  test('with orders for later off the dialog is a plain list: no picker, nothing to add', async ({ page }) => {
    await mock(page, { noSlots: true });
    await page.goto('/shops/test-shop');
    await page.getByTestId('other-times-button').click();
    const d = dialog(page);
    await expect(d.getByText('Brunch')).toBeVisible();
    await expect(d.getByText('Sunday Roast')).toBeVisible();
    await expect(d.getByRole('button', { name: /Brunch|Sunday Roast/ })).toHaveCount(0);
    await expect(d.locator('select')).toHaveCount(0);
    await expect(d.getByText(/not taking orders for later/)).toBeVisible();
    // no closed dish is on the menu, so none can be added
    await expect(page.getByTestId('menu').getByText(/Pancakes|Sunday Roast/)).toHaveCount(0);
  });

  test('picking a day and time switches the catalog to that moment; Change and Back to now work', async ({ page }) => {
    const fake = await mock(page);
    await page.goto('/shops/test-shop');
    await expect(page.getByTestId('other-time-banner')).toHaveCount(0);
    await expect(page.getByText('Pancakes')).toHaveCount(0);
    await pickBrunch(page);
    const banner = page.getByTestId('other-time-banner');
    await expect(banner).toContainText('Ordering for');
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByText('Pancakes').first()).toBeVisible(); // Brunch is on the menu for that moment
    expect(fake.catalogAts.at(-1)).toMatch(/^\d{4}-\d\d-\d\dT.*Z$/);
    // survives a reload for this visit
    await page.reload();
    await expect(page.getByTestId('other-time-banner')).toContainText('Ordering for');
    // Change reopens at the day/time step
    await page.getByRole('button', { name: 'Change' }).click();
    await expect(page.getByRole('heading', { name: 'Choose a day and time' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await expect(banner).toContainText('Ordering for');
    // Back to now
    await page.getByRole('button', { name: 'Back to now' }).click();
    await expect(page.getByTestId('other-time-banner')).toHaveCount(0);
    await expect(page.getByText('Pancakes')).toHaveCount(0);
    await expect.poll(() => fake.catalogAts.at(-1)).toBeNull();
  });

  test('Escape closes the dialog without applying and returns focus to the button', async ({ page }) => {
    await mock(page);
    await page.goto('/shops/test-shop');
    const button = page.getByTestId('other-times-button');
    await button.click();
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await expect(button).toBeFocused();
    await expect(page.getByTestId('other-time-banner')).toHaveCount(0);
  });

  test('a basket item not served then is named first; Cancel keeps everything, Confirm removes it', async ({ page }) => {
    await mock(page);
    await seedCart(page, [{ id: 'p4', name: 'Late soup' }]);
    await page.goto('/shops/test-shop');
    await pickBrunch(page);
    const d = page.getByRole('dialog', { name: 'Some items are not served then' });
    await expect(d).toContainText('Late soup');
    await expect(page.getByTestId('other-time-banner')).toHaveCount(0);
    // Cancel: back to the picker, nothing changed
    await d.getByRole('button', { name: 'Keep current time' }).click();
    await expect(page.getByRole('heading', { name: 'Choose a day and time' })).toBeVisible();
    await expect(page.getByTestId('other-time-banner')).toHaveCount(0);
    expect(await page.evaluate(() => sessionStorage.getItem('other_time_v1:test-shop'))).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('cart_v1:test-shop'))).toContain('p4');
    // Confirm: item removed, time applied
    await page.getByRole('button', { name: 'Order for this time' }).click();
    await page.getByRole('button', { name: 'Remove and change time' }).click();
    await expect(page.getByTestId('other-time-banner')).toContainText('Ordering for');
    expect(await page.evaluate(() => localStorage.getItem('cart_v1:test-shop'))).not.toContain('p4');
  });

  test('the chosen time is pre-selected at checkout', async ({ page }) => {
    await mock(page);
    await seedCart(page, [{ id: 'p1', name: 'Carbonara' }]);
    await page.goto('/shops/test-shop');
    await pickBrunch(page);
    await expect(page.getByTestId('other-time-banner')).toBeVisible();
    const iso = await page.evaluate(() => JSON.parse(sessionStorage.getItem('other_time_v1:test-shop')!).iso as string);
    await page.goto('/shops/test-shop/checkout');
    await expect(page.getByRole('radio', { name: /later/i }).first()).toBeChecked();
    await expect(page.getByLabel('Time', { exact: true })).toHaveValue(iso);
  });

  test('phone layout: no horizontal scroll, tap targets at least 44px', async ({ page }) => {
    await mock(page);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/shops/test-shop');
    await page.getByTestId('other-times-button').click();
    await expect(dialog(page)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const b of await dialog(page).getByRole('button').all()) {
      const box = await b.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
  });
});
