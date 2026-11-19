import { test, expect, type Page, type Route } from '@playwright/test';

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

async function mockLegal(page: Page) {
  await page.route('**/api/shops/slug/test-shop/legal**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        slug: 'test-shop',
        shopName: 'Test Shop',
        language: 'en',
        impressum: null,
        terms: null,
        withdrawal: null,
        privacyNotice: null,
        seller: { legalName: 'Test Shop GmbH', phone: '030 1234567' },
        platform: { name: 'Fair Technology', salesSiteUrl: null },
      }),
    });
  });
}

/** Capture the request body the page posts, and let the handler build the response. */
async function mockSubmit(page: Page, handler: (body: Record<string, unknown>) => { status: number; body: unknown }) {
  const captured: { body: Record<string, unknown> | null } = { body: null };
  await page.route('**/api/shops/shop-t/content-reports', async (route: Route) => {
    captured.body = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
    const { status, body } = handler(captured.body);
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return captured;
}

test.use({ locale: 'en-US' });

test.describe('Content report', () => {
  test('the shop page shows the report link and it opens the form', async ({ page }) => {
    await mockShop(page);
    await mockLegal(page);
    await page.goto('/shops/test-shop');

    const link = page.getByRole('link', { name: 'Report illegal content' }).first();
    await expect(link).toBeVisible();
    await link.click();

    await expect(page).toHaveURL(/\/shops\/test-shop\/report$/);
    await expect(page.getByRole('heading', { name: 'Report illegal content' })).toBeVisible();
    // Resolved shop: the header still names the shop
    await expect(page.getByRole('banner').getByRole('button', { name: 'Go to Test Shop' })).toBeVisible();
  });

  test('header is never an empty "Go to" button when the shop fails to load', async ({ page }) => {
    await mockLegal(page);
    await page.route('**/api/shops/slug/test-shop', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' }),
    );
    await page.goto('/shops/test-shop/report');

    const header = page.getByRole('banner');
    await expect(header.getByRole('button', { name: 'Back to the menu' })).toBeVisible();
    await expect(header.getByRole('button', { name: /^Go to\s*$/ })).toHaveCount(0);
  });

  test('an anonymous report shows the receipt id', async ({ page }) => {
    await mockShop(page);
    await mockLegal(page);
    const request = await mockSubmit(page, () => ({
      status: 200,
      body: { reportId: 'rep-123', status: 'received', receivedAt: '2026-11-15T10:00:00.000Z' },
    }));
    await page.goto('/shops/test-shop/report');

    await page.getByTestId('report-category').selectOption('other');
    await page.getByTestId('report-reason').fill('This listing sells stolen goods.');
    await page.getByRole('button', { name: 'Send report' }).click();

    await expect(page.getByTestId('report-id')).toHaveText('rep-123');
    await expect(page.getByTestId('report-receipt')).toBeVisible();
    expect(request.body).not.toBeNull();
    expect(request.body).not.toHaveProperty('reporterName');
    expect(request.body).not.toHaveProperty('reporterEmail');
  });

  test('empty form is validated client-side: no API call, translated errors, focus on first invalid field', async ({ page }) => {
    await mockShop(page);
    await mockLegal(page);
    const request = await mockSubmit(page, () => ({ status: 200, body: {} }));
    await page.goto('/shops/test-shop/report');

    await page.getByTestId('report-reason').fill('   ');
    await page.getByTestId('report-url').fill('javascript:alert(1)');
    await page.getByRole('button', { name: 'Send report' }).click();

    await expect(page.getByTestId('error-category')).toHaveText('Please choose a category.');
    await expect(page.getByTestId('error-reason')).toHaveText('Please describe the problem.');
    await expect(page.getByTestId('error-contentUrl')).toContainText('http:// or https://');
    await expect(page.getByTestId('report-category')).toBeFocused();
    expect(request.body).toBeNull();
  });

  test('a non-http content URL is rejected, an https one is accepted', async ({ page }) => {
    await mockShop(page);
    await mockLegal(page);
    const request = await mockSubmit(page, () => ({
      status: 200,
      body: { reportId: 'rep-1', status: 'received', receivedAt: '2026-11-15T10:00:00.000Z' },
    }));
    await page.goto('/shops/test-shop/report');

    await page.getByTestId('report-category').selectOption('other');
    await page.getByTestId('report-reason').fill('Bad listing.');
    await page.getByTestId('report-url').fill('ftp://example.com/x');
    await page.getByRole('button', { name: 'Send report' }).click();
    await expect(page.getByTestId('error-contentUrl')).toBeVisible();
    await expect(page.getByTestId('report-url')).toBeFocused();
    expect(request.body).toBeNull();

    await page.getByTestId('report-url').fill('HTTPS://example.com/x');
    await page.getByRole('button', { name: 'Send report' }).click();
    await expect(page.getByTestId('report-id')).toHaveText('rep-1');
  });

  test('a server 400 shows the translated generic error, never the backend text', async ({ page }) => {
    await mockShop(page);
    await mockLegal(page);
    await mockSubmit(page, () => ({
      status: 400,
      body: { error: 'reason is required and must be a non-empty string' },
    }));
    await page.goto('/shops/test-shop/report');

    await page.getByTestId('report-category').selectOption('other');
    await page.getByTestId('report-reason').fill('Something is wrong here.');
    await page.getByRole('button', { name: 'Send report' }).click();

    const alert = page.getByTestId('report-error');
    await expect(alert).toContainText('Something went wrong. Please try again.');
    await expect(alert).not.toContainText('non-empty string');
  });
});
