import { test, expect, type Page } from '@playwright/test';

async function mockShop(page: Page) {
  await page.route('**/api/shops/slug/test-shop', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'shop-t', slug: 'test-shop', name: 'Test Shop', branding: null }),
    });
  });
  await page.route('**/api/shops/shop-t/catalog**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ language: 'en', languages: ['en'], categories: [] }),
    });
  });
}

async function mockLegal(page: Page, overrides: Record<string, unknown> = {}) {
  await page.route('**/api/shops/slug/test-shop/legal**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        slug: 'test-shop',
        shopName: 'Test Shop',
        language: 'en',
        impressum: {
          lines: [
            { label: 'Provider', value: 'Test Shop GmbH' },
            { label: 'Phone', value: '030 1234567' },
          ],
        },
        terms: null,
        withdrawal: {
          text: 'No right of withdrawal for freshly prepared food.',
          revision: 1,
          updatedAt: '2026-10-01T00:00:00Z',
        },
        privacyNotice: {
          templateVersion: '2026-10-01-draft',
          isDraft: true,
          sections: [{ heading: 'Controller', paragraphs: ['Test Shop GmbH'] }],
        },
        seller: { legalName: 'Test Shop GmbH', phone: '030 1234567' },
        platform: { name: 'Fair Technology', salesSiteUrl: null },
        ...overrides,
      }),
    });
  });
}

test.use({ locale: 'en-US' });

test.describe('Legal pages', () => {
  test("footer shows the restaurant's legal links and the platform line", async ({ page }) => {
    await mockShop(page);
    await mockLegal(page);
    await page.goto('/shops/test-shop');

    await expect(page.getByRole('link', { name: 'Legal notice' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Terms' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Withdrawal policy' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Privacy' })).toBeVisible();
    await expect(page.getByText('Ordering by Fair Technology')).toBeVisible();
  });

  test('impressum page shows the generated lines', async ({ page }) => {
    await mockShop(page);
    await mockLegal(page);
    await page.goto('/shops/test-shop/legal/impressum');

    await expect(page.getByText('Test Shop GmbH')).toBeVisible();
    await expect(page.getByText('030 1234567')).toBeVisible();
  });

  test('an unpublished page says so', async ({ page }) => {
    await mockShop(page);
    await mockLegal(page);
    await page.goto('/shops/test-shop/legal/terms');

    await expect(page.getByText('This restaurant has not published this page yet.')).toBeVisible();
  });

  test('checkout shows the seller statement and allergy line', async ({ page }) => {
    await mockShop(page);
    await mockLegal(page);
    await page.goto('/shops/test-shop/checkout');

    await expect(page.getByTestId('seller-statement')).toHaveText(
      'This order is a contract between you and Test Shop GmbH. Fair Technology provides the ordering software.',
    );
    await expect(
      page.getByText('Allergies or intolerances? Please call Test Shop GmbH on 030 1234567 before ordering.'),
    ).toBeVisible();
    await expect(page.getByText('Kitchen requests (e.g. no onions) — not for allergies')).toBeVisible();
  });

  test('sub-processor page lists Microsoft', async ({ page }) => {
    await page.route('**/api/legal/platform', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          platformName: 'Fair Technology',
          salesSiteUrl: null,
          operator: { legalName: '', address: '', email: '' },
          euRepresentative: null,
          subProcessors: [
            {
              id: 'azure',
              name: 'Microsoft Ireland Operations Ltd. — Microsoft Azure',
              purpose: { de: 'x', en: 'Hosting, database and file storage' },
              location: { de: 'x', en: 'EU (West Europe region, Netherlands)' },
            },
          ],
          currentDpaVersion: '2026-10-01-draft',
          currentDpaIsDraft: true,
        }),
      });
    });
    await page.goto('/legal/sub-processors');

    await expect(page.getByText('Microsoft Ireland Operations Ltd. — Microsoft Azure')).toBeVisible();
  });
});
