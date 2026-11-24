import { test, expect } from '@playwright/test';

test('order page without ?t= token shows not-found and a back link immediately', async ({ page }) => {
  await page.route('**/api/shops/**', (route) => route.abort());
  await page.route('**/api/customer-orders/*/view', (route) =>
    route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Order not found' }),
    }),
  );

  await page.goto('/shops/mapasta/orders/does-not-exist');

  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible({ timeout: 3000 });
  await expect(alert).toContainText(/could not find this order/i);
  const back = alert.getByRole('link', { name: 'Back to the menu' });
  await expect(back).toBeVisible({ timeout: 3000 });
  await expect(back).toHaveAttribute('href', '/shops/mapasta');
});
