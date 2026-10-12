import { test, expect } from '@playwright/test';

test.describe('No customer accounts', () => {
  test('my-orders page no longer exists', async ({ page }) => {
    await page.goto('/shops/pizzeria-kreuzberg/my-orders');
    await expect(
      page.getByRole('heading', { name: /This page doesn.t exist|Diese Seite gibt es nicht/ }),
    ).toBeVisible();
  });
});
