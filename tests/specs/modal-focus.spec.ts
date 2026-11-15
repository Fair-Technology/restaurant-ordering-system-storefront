import { test, expect, type Page } from '@playwright/test';

test.use({ locale: 'en-US' });

const GLUTEN = { id: 'gluten', label: 'Cereals containing gluten' };
const FISH = { id: 'fish', label: 'Fish' };

const dish = (o: Record<string, unknown>) => ({
  description: '',
  images: [],
  variants: [],
  addons: [],
  isAvailable: true,
  allergens: [],
  additives: [],
  dietaryTags: [],
  spice: null,
  unavailableModes: [],
  combo: null,
  createdAt: 'x',
  updatedAt: 'x',
  ...o,
});

const SALAD = dish({
  id: 'p2',
  name: 'Insalata',
  price: 800,
  addons: [
    {
      id: 'dr',
      name: 'Dressing',
      minSelectable: 0,
      maxSelectable: 1,
      options: [{ id: 'oil', name: 'Oil', priceDelta: 0, isAvailable: true }],
    },
  ],
});
const PASTA = dish({
  id: 'p3',
  name: 'Carbonara',
  price: 1000,
  allergens: [GLUTEN],
  addons: [
    {
      id: 'px',
      name: 'Pasta extras',
      minSelectable: 0,
      maxSelectable: 2,
      options: [{ id: 'salmon', name: 'Salmon', priceDelta: 200, isAvailable: true, allergens: [FISH], additives: [] }],
    },
  ],
});
const COMBO = dish({
  id: 'm1',
  name: 'Pasta Menu',
  price: 1200,
  allergens: [GLUTEN],
  combo: { groups: [{ id: 'g-main', name: 'Main', productIds: ['p3'] }] },
});

async function mockMenu(page: Page) {
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
        categories: [{ id: 'c1', name: 'Menu', sortOrder: 1, products: [SALAD, PASTA, COMBO] }],
      }),
    }),
  );
}

async function open(page: Page, name: string) {
  await page.getByRole('button', { name: `View details for ${name}` }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

// Where focus is now: tag, a readable label, and whether the dialog holds it
async function focusNow(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector('[role="dialog"]');
    return {
      tag: el?.tagName ?? '',
      label: el?.getAttribute('aria-label') ?? el?.textContent?.trim() ?? '',
      isDialog: el === dialog,
      inside: !!el && !!dialog && dialog.contains(el),
    };
  });
}

test.beforeEach(async ({ page }) => {
  await mockMenu(page);
  await page.goto('/shops/test-shop');
});

for (const name of ['Insalata', 'Pasta Menu']) {
  test.describe(name, () => {
    test('focus returns to the trigger on close', async ({ page }) => {
      await open(page, name);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.getByRole('button', { name: `View details for ${name}` })).toBeFocused();
    });

    test('focus is trapped while open', async ({ page }) => {
      await open(page, name);
      const steps = [];
      for (let i = 0; i < 8; i += 1) {
        await page.keyboard.press('Tab');
        steps.push(await focusNow(page));
      }
      for (const step of steps) {
        expect(step.inside, JSON.stringify(step)).toBe(true);
        expect(step.tag).not.toBe('BODY');
      }
      // Tab never rests on the dialog element itself, so the cycle starts at the first control
      const first = steps[0];
      expect(first.isDialog).toBe(false);
      // The cycle wraps: once the first control comes round again, everything in between was inside too
      const again = steps.findIndex((s, i) => i > 0 && s.tag === first.tag && s.label === first.label);
      expect(again).toBeGreaterThan(0);

      // The last control of the cycle sits just before the first one comes round again
      const last = steps[again - 1];

      // From the dialog itself, Tab reaches the first control and Shift+Tab then wraps to the last, still inside
      await page.evaluate(() => (document.querySelector('[role="dialog"]') as HTMLElement).focus());
      await page.keyboard.press('Tab');
      expect(await focusNow(page)).toEqual(first);
      await page.keyboard.press('Shift+Tab');
      const back = await focusNow(page);
      expect(back.inside).toBe(true);
      expect(back.tag).not.toBe('BODY');
      expect(back).toEqual(last);
      await page.keyboard.press('Tab');
      expect(await focusNow(page)).toEqual(first);
    });
  });
}
