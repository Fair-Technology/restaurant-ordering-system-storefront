import { type Page, type Locator } from '@playwright/test';

export class HomePage {
  //properties
  readonly page: Page;
  readonly heading: Locator;
  readonly shopGrid: Locator;
  readonly shopCards: Locator;
  readonly loadingIndicator: Locator;
  readonly errorMessage: Locator;
  readonly emptyState: Locator;

  //constructor
  constructor(page: Page) {
    this.page = page;

    this.heading = page.getByRole('heading', {
      name: /order straight from the restaurant|direkt beim restaurant bestellen/i,
    });
    this.shopGrid = page.locator('[data-testid="shop-grid"]');
    this.shopCards = page.locator('[data-testid="shop-card"]');
    this.loadingIndicator = page.locator('[data-testid="loading-indicator"]');
    this.errorMessage = page.locator('[data-testid="error-message"]');
    this.emptyState = page.locator('[data-testid="empty-state"]');
  }

  //actions
  async goto() {
    await this.page.goto('/');
  }

  async clickFirstShop() {
    await this.shopCards.first().click();
  }

  async clickShopByName(shopName: string) {
    await this.page.getByRole('link', { name: shopName }).click();
  }

  async getShopCount(): Promise<number> {
    return await this.shopCards.count();
  }

  async getShopNameAt(index: number): Promise<string> {
    return await this.shopCards
      .nth(index)
      .locator('[data-testid="shop-name"]')
      .innerText();
  }
}
