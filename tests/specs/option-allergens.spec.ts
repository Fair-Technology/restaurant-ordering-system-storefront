import { test, expect, type Page } from '@playwright/test';

test.use({ locale: 'en-US' });

const GLUTEN = { id: 'gluten', label: 'Cereals containing gluten' };
const FISH = { id: 'fish', label: 'Fish' };
const EGGS = { id: 'eggs', label: 'Eggs' };
const MILK = { id: 'milk', label: 'Milk (including lactose)' };
const PRES = { id: 'preservative', code: 2, label: 'with preservative' };
const COL = { id: 'colouring', code: 1, label: 'with colouring' };

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

const PIZZA = dish({
  id: 'p1',
  name: 'Pizza Tonno',
  price: 900,
  allergens: [GLUTEN],
  additives: [PRES],
  variants: [
    {
      id: 'crust',
      name: 'Crust',
      options: [
        { id: 'plain', name: 'Plain crust', priceDelta: 0, isAvailable: true, allergens: [], additives: [] },
        { id: 'cheese', name: 'Cheese crust', priceDelta: 200, isAvailable: true, allergens: [MILK], additives: [] },
      ],
    },
  ],
  addons: [
    {
      id: 'extras',
      name: 'Extras',
      minSelectable: 0,
      maxSelectable: 3,
      options: [
        { id: 'tuna', name: 'Tuna', priceDelta: 150, isAvailable: true, allergens: [FISH], additives: [] },
        { id: 'aioli', name: 'Aioli', priceDelta: 100, isAvailable: true, allergens: [EGGS], additives: [COL] },
        { id: 'bread', name: 'Bread', priceDelta: 50, isAvailable: true, allergens: [GLUTEN], additives: [] },
      ],
    },
  ],
});
// No option allergen keys, as an older backend sends.
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

async function mockMenu(page: Page, language: 'en' | 'de') {
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
        language,
        languages: [language],
        categories: [{ id: 'c1', name: 'Menu', sortOrder: 1, products: [PIZZA, SALAD, PASTA, COMBO] }],
      }),
    }),
  );
}

async function open(page: Page, name: string) {
  await page.getByRole('button', { name: `View details for ${name}` }).click();
}

test.beforeEach(async ({ page }) => {
  await mockMenu(page, 'en');
  await page.goto('/shops/test-shop');
});

test('the allergen list grows and shrinks with the extras picked', async ({ page }) => {
  await open(page, 'Pizza Tonno');
  await expect(page.getByTestId('dish-allergens')).toHaveText('Cereals containing gluten');
  await expect(page.getByTestId('dish-additives')).toHaveText('2 with preservative');
  await page.getByText('Tuna', { exact: true }).click();
  await expect(page.getByTestId('dish-allergens')).toHaveText('Cereals containing gluten, Fish');
  await page.getByText('Aioli', { exact: true }).click();
  await expect(page.getByTestId('dish-allergens')).toHaveText('Cereals containing gluten, Fish, Eggs');
  await expect(page.getByTestId('dish-additives')).toHaveText('1 with colouring, 2 with preservative');
  await page.getByText('Tuna', { exact: true }).click();
  await expect(page.getByTestId('dish-allergens')).toHaveText('Cereals containing gluten, Eggs');
});

test('a size adds its allergens and switching back removes them', async ({ page }) => {
  await open(page, 'Pizza Tonno');
  await page.getByText('Cheese crust', { exact: true }).click();
  await expect(page.getByTestId('dish-allergens')).toHaveText('Cereals containing gluten, Milk (including lactose)');
  await page.getByText('Plain crust', { exact: true }).click();
  await expect(page.getByTestId('dish-allergens')).toHaveText('Cereals containing gluten');
});

test("an extra repeating the dish's allergen lists it once", async ({ page }) => {
  await open(page, 'Pizza Tonno');
  await page.getByText('Bread', { exact: true }).click();
  await expect(page.getByTestId('dish-allergens')).toHaveText('Cereals containing gluten');
});

test('the note shows only when an option declares something', async ({ page }) => {
  await open(page, 'Pizza Tonno');
  await expect(page.getByTestId('dish-declaration-varies')).toHaveText('Updates with the options you choose');
  await page.keyboard.press('Escape');
  await open(page, 'Insalata');
  await expect(page.getByTestId('dish-declaration-varies')).toHaveCount(0);
  await page.getByText('Oil', { exact: true }).click();
  await expect(page.getByTestId('dish-allergens')).toHaveText('Contains none of the 14 declarable allergens');
});

test('a combo adds the extras picked inside it', async ({ page }) => {
  await open(page, 'Pasta Menu');
  await expect(page.getByTestId('combo-allergens')).toHaveText('Cereals containing gluten');
  await page.getByText('Salmon', { exact: true }).click();
  await expect(page.getByTestId('combo-allergens')).toHaveText('Cereals containing gluten, Fish');
  await expect(page.getByTestId('combo-declaration-varies')).toHaveText('Updates with the options you choose');
});

test.describe('in German', () => {
  test.use({ locale: 'de-DE' });
  test('the note is in German', async ({ page }) => {
    await page.unroute('**/api/shops/shop-t/catalog**');
    await mockMenu(page, 'de');
    await page.goto('/shops/test-shop');
    await open(page, 'Pizza Tonno');
    await expect(page.getByTestId('dish-declaration-varies')).toHaveText('Ändert sich mit den gewählten Optionen');
  });
});
