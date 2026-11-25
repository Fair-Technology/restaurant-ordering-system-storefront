import { test, expect, type Page } from '@playwright/test';

test.use({ locale: 'en-US' });

const opt = (id: string, name: string, priceDelta = 0, category?: string) => ({
  id, name, priceDelta, isAvailable: true, allergens: [], additives: [], ...(category ? { category } : {}),
});

const PERONCINO = {
  id: 'p1',
  name: 'Peperoncino',
  description: 'Chilli and tomatoes',
  price: 1150,
  images: [],
  isAvailable: true,
  allergens: [{ id: 'gluten', label: 'Cereals containing gluten' }],
  additives: [],
  dietaryTags: [],
  spice: null,
  variants: [
    {
      id: 'dough',
      name: 'Dough type',
      options: [opt('regular', 'Regular'), opt('spelt', 'Spelt Pasta', 100)],
    },
  ],
  addons: [
    {
      id: 'pasta',
      name: 'Pasta',
      minSelectable: 1,
      maxSelectable: 1,
      options: [opt('spag', 'Spaghetti'), opt('gnocchi', 'Gnocchi', 100)],
    },
    {
      id: 'extras',
      name: 'Extras',
      minSelectable: 0,
      maxSelectable: 5,
      options: [
        opt('grana', 'Grana Padano', 100, 'Cheese'),
        opt('tuna', 'Tuna', 250, 'Protein'),
        opt('mozz', 'Mozzarella', 250, 'Cheese'),
      ],
    },
  ],
};

const SIMPLE = { ...PERONCINO, id: 'p2', name: 'Water', price: 300, variants: [], addons: [] };

async function mock(page: Page) {
  await page.route('**/api/shops/slug/test-shop', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'shop-t', slug: 'test-shop', name: 'Test Shop', currency: 'EUR', branding: null }) }),
  );
  await page.route('**/api/shops/shop-t/catalog**', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ language: 'en', languages: ['en'], categories: [{ id: 'c1', name: 'Menu', sortOrder: 1, products: [PERONCINO, SIMPLE] }] }),
    }),
  );
  await page.goto('/shops/test-shop');
}

const cartLines = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('cart_v1:test-shop') || '[]'));

test.describe('phone: guided steps', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('pasta is required, then extras, review and confirmation', async ({ page }) => {
    await mock(page);
    await page.getByRole('button', { name: 'View details for Peperoncino' }).click();
    const dialog = page.getByRole('dialog');

    // Step 1: no pasta chosen, dough defaults to Regular, allergens visible
    await expect(dialog.getByText('Step 1 of 3 · Your pasta')).toBeVisible();
    await expect(dialog.getByRole('radio', { name: /Regular/ })).toBeChecked();
    await expect(dialog.getByTestId('dish-allergens')).toHaveText('Cereals containing gluten');
    const choose = dialog.getByRole('button', { name: 'Choose your pasta' });
    await choose.click();
    await expect(dialog.getByRole('alert')).toHaveText('Please choose a pasta to continue.');
    await expect(dialog.getByText('Required')).toBeVisible();

    await dialog.getByText('Gnocchi', { exact: true }).click();
    await expect(dialog.getByText('Please choose a pasta to continue.')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Next' }).click();

    // Step 2: extras grouped by category; the button skips until one is chosen
    await expect(dialog.getByText('Step 2 of 3 · Extras')).toBeVisible();
    await expect(dialog.getByText('Cheese', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Protein', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Skip extras' })).toBeVisible();
    await dialog.getByText('Tuna', { exact: true }).click();
    await dialog.getByRole('button', { name: 'Next' }).click();

    // Step 3: review with Change links, allergens and quantity
    await expect(dialog.getByRole('heading', { name: 'Review your dish' })).toBeVisible();
    await expect(dialog.getByText('Per dish €15.00')).toBeVisible();
    await expect(dialog.getByTestId('dish-allergens')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Change' })).toHaveCount(3);
    await dialog.getByRole('button', { name: 'More' }).or(dialog.getByRole('button', { name: 'Increase quantity' })).click();
    await dialog.getByRole('button', { name: /Add to order/ }).click();

    await expect(dialog.getByText('Added to your order')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Continue ordering' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'View cart (2)' })).toBeVisible();
    const lines = await cartLines(page);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ quantity: 2, variantId: 'regular', addonOptionIds: expect.arrayContaining(['gnocchi', 'tuna']) });

    // a click right after adding (a double-click's second half) is ignored
    await page.waitForTimeout(700);
    await dialog.getByRole('button', { name: 'Continue ordering' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('Change on the review step goes back to that step', async ({ page }) => {
    await mock(page);
    await page.getByRole('button', { name: 'View details for Peperoncino' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByText('Spaghetti', { exact: true }).click();
    await dialog.getByRole('button', { name: 'Next' }).click();
    await dialog.getByRole('button', { name: 'Skip extras' }).click();
    await dialog.getByRole('button', { name: 'Change' }).last().click();
    await expect(dialog.getByText('Step 2 of 3 · Extras')).toBeVisible();
  });

  test('a dish with no required choice adds directly', async ({ page }) => {
    await mock(page);
    await page.getByRole('button', { name: 'View details for Water' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/Step 1 of/)).toHaveCount(0);
    await dialog.getByRole('button', { name: /Add to order/ }).click();
    await expect(dialog.getByText('Added to your order')).toBeVisible();
    expect(await cartLines(page)).toHaveLength(1);
  });
});

test.describe('desktop: one page', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('required pasta, collapsed extras, price in the button', async ({ page }) => {
    await mock(page);
    await page.getByRole('button', { name: 'View details for Peperoncino' }).click();
    const dialog = page.getByRole('dialog');

    const choose = dialog.getByRole('button', { name: 'Choose your pasta' });
    await expect(choose).toBeVisible();
    await expect(dialog.getByText('Start by choosing your pasta')).toBeVisible();
    await choose.click();
    await expect(dialog.getByText('Please choose a pasta to continue.').first()).toBeVisible();
    await expect(dialog.getByRole('radio', { name: /Regular/ })).toBeChecked();

    // Extras stay collapsed until the row is opened
    await expect(dialog.getByText('Tuna', { exact: true })).toHaveCount(0);
    await dialog.getByRole('button', { name: /Add extras/ }).click();
    await expect(dialog.getByText('Cheese', { exact: true })).toBeVisible();
    await dialog.getByText('Mozzarella', { exact: true }).click();

    await dialog.getByText('Spaghetti', { exact: true }).click();
    const add = dialog.getByRole('button', { name: /Add to order/ });
    await expect(add).toContainText('€14.00');
    await add.click();
    await expect(dialog.getByText(/Added to your order · 1 × Peperoncino/)).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'View cart (1)' })).toBeVisible();
  });

  test('View cart opens the cart', async ({ page }) => {
    await mock(page);
    await page.getByRole('button', { name: 'View details for Water' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: /Add to order/ }).click();
    await page.waitForTimeout(700);
    await dialog.getByRole('button', { name: /View cart/ }).click();
    // the customise popup is gone and the cart panel (also a dialog) is open with the dish in it
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(page.getByRole('dialog').getByText('Water')).toBeVisible();
  });
});
