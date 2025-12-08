import { test, expect, Page } from '@playwright/test';

/**
 * Test Data - All users with password: secret_sauce
 */
export const USERS = {
  standard: 'standard_user',
  locked: 'locked_out_user',
  problem: 'problem_user',
  performance: 'performance_glitch_user',
  error: 'error_user',
  visual: 'visual_user',
};

export const PASSWORD = 'secret_sauce';

/**
 * Page Object: Login Page
 */
export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/');
  }

  async login(username: string, password: string) {
    // Intentional issue: Using fragile ID selectors that might break
    await this.page.locator('#user-name').fill(username);
    await this.page.locator('#password').fill(password);
    await this.page.locator('#login-button').click();
  }

  async getErrorMessage() {
    return await this.page.locator('[data-test="error"]').textContent();
  }

  async isLoginButtonVisible() {
    return await this.page.locator('#login-button').isVisible();
  }
}

/**
 * Page Object: Inventory Page
 */
export class InventoryPage {
  constructor(private page: Page) {}

  async getProductCount() {
    // Intentional issue: Timeout-prone selector
    await this.page.waitForSelector('.inventory_item', { timeout: 5000 });
    return await this.page.locator('.inventory_item').count();
  }

  async addToCartByName(productName: string) {
    // Intentional issue: Text-based selector that's fragile
    const product = this.page.locator('.inventory_item', { hasText: productName });
    await product.locator('button').click();
  }

  async addToCartByIndex(index: number) {
    const products = this.page.locator('.inventory_item');
    await products.nth(index).locator('button').click();
  }

  async getCartBadgeCount() {
    const badge = this.page.locator('.shopping_cart_badge');
    const text = await badge.textContent();
    return text ? parseInt(text) : 0;
  }

  async sortProducts(sortOption: string) {
    await this.page.locator('.product_sort_container').selectOption(sortOption);
  }

  async getFirstProductName() {
    return await this.page.locator('.inventory_item_name').first().textContent();
  }

  async openCart() {
    await this.page.locator('.shopping_cart_link').click();
  }
}

/**
 * Page Object: Cart Page
 */
export class CartPage {
  constructor(private page: Page) {}

  async getItemCount() {
    return await this.page.locator('.cart_item').count();
  }

  async removeItem(index: number) {
    const items = this.page.locator('.cart_item');
    await items.nth(index).locator('button').click();
  }

  async continueShopping() {
    await this.page.locator('#continue-shopping').click();
  }

  async checkout() {
    // Intentional issue: Race condition - button might not be ready
    await this.page.locator('#checkout').click();
  }

  async getItemNames() {
    return await this.page.locator('.inventory_item_name').allTextContents();
  }
}

/**
 * Page Object: Checkout Page
 */
export class CheckoutPage {
  constructor(private page: Page) {}

  async fillShippingInfo(firstName: string, lastName: string, zipCode: string) {
    // Intentional issue: Using brittle ID selectors
    await this.page.locator('#first-name').fill(firstName);
    await this.page.locator('#last-name').fill(lastName);
    await this.page.locator('#postal-code').fill(zipCode);
  }

  async continue() {
    // Intentional issue: Timeout might be too short
    await this.page.locator('#continue').click({ timeout: 3000 });
  }

  async getTotal() {
    const totalText = await this.page.locator('.summary_total_label').textContent();
    return totalText ? parseFloat(totalText.replace(/[^0-9.]/g, '')) : 0;
  }

  async finish() {
    await this.page.locator('#finish').click();
  }

  async isCompleteHeaderVisible() {
    // Intentional issue: Fragile class selector
    return await this.page.locator('.complete-header').isVisible();
  }

  async getCompleteText() {
    return await this.page.locator('.complete-header').textContent();
  }
}

/**
 * Fixtures for reusable page objects
 */
export const test_with_pages = test.extend<{
  loginPage: LoginPage;
  inventoryPage: InventoryPage;
  cartPage: CartPage;
  checkoutPage: CheckoutPage;
}>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  inventoryPage: async ({ page }, use) => {
    await use(new InventoryPage(page));
  },
  cartPage: async ({ page }, use) => {
    await use(new CartPage(page));
  },
  checkoutPage: async ({ page }, use) => {
    await use(new CheckoutPage(page));
  },
});
