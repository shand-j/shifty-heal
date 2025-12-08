import { test, expect } from '@playwright/test';
import { USERS, PASSWORD, LoginPage, InventoryPage, CartPage, CheckoutPage } from './fixtures';

test.describe('Checkout Flow Tests', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    const inventoryPage = new InventoryPage(page);
    const cartPage = new CartPage(page);
    
    await page.goto('/');
    await loginPage.login(USERS.standard, PASSWORD);
    await inventoryPage.addToCartByIndex(0);
    await inventoryPage.addToCartByIndex(2);
    await inventoryPage.openCart();
    await cartPage.checkout();
  });

  test('complete checkout with valid information', async ({ page }) => {
    const checkoutPage = new CheckoutPage(page);
    
    await checkoutPage.fillShippingInfo('John', 'Doe', '12345');
    await checkoutPage.continue();
    
    // Intentional issue: Selector might be fragile
    await expect(page.locator('.summary_info')).toBeVisible();
    
    await checkoutPage.finish();
    
    await expect(page).toHaveURL(/.*checkout-complete/);
    expect(await checkoutPage.isCompleteHeaderVisible()).toBe(true);
  });

  test('checkout fails without first name', async ({ page }) => {
    const checkoutPage = new CheckoutPage(page);
    
    await checkoutPage.fillShippingInfo('', 'Doe', '12345');
    
    // Intentional issue: Timeout might be too short
    await page.locator('#continue').click({ timeout: 2000 });
    
    const error = await page.locator('[data-test="error"]').textContent();
    expect(error).toContain('First Name is required');
  });

  test('checkout fails without last name', async ({ page }) => {
    const checkoutPage = new CheckoutPage(page);
    
    await checkoutPage.fillShippingInfo('John', '', '12345');
    await checkoutPage.continue();
    
    const error = await page.locator('[data-test="error"]').textContent();
    expect(error).toContain('Last Name is required');
  });

  test('checkout fails without zip code', async ({ page }) => {
    const checkoutPage = new CheckoutPage(page);
    
    await checkoutPage.fillShippingInfo('John', 'Doe', '');
    await checkoutPage.continue();
    
    // Intentional issue: Race condition with error display
    await page.waitForTimeout(100);
    
    const error = await page.locator('[data-test="error"]').textContent();
    expect(error).toContain('Postal Code is required');
  });

  test('checkout summary displays correct total', async ({ page }) => {
    const checkoutPage = new CheckoutPage(page);
    
    await checkoutPage.fillShippingInfo('John', 'Doe', '12345');
    await checkoutPage.continue();
    
    const total = await checkoutPage.getTotal();
    
    // Total should be greater than 0
    expect(total).toBeGreaterThan(0);
  });

  test('cancel from checkout step one returns to cart', async ({ page }) => {
    // Intentional issue: Brittle selector
    await page.locator('#cancel').click();
    
    await expect(page).toHaveURL(/.*cart/);
  });

  test('cancel from checkout step two returns to inventory', async ({ page }) => {
    const checkoutPage = new CheckoutPage(page);
    
    await checkoutPage.fillShippingInfo('John', 'Doe', '12345');
    await checkoutPage.continue();
    
    await page.locator('#cancel').click();
    
    await expect(page).toHaveURL(/.*inventory/);
  });

  test('checkout success message is displayed', async ({ page }) => {
    const checkoutPage = new CheckoutPage(page);
    
    await checkoutPage.fillShippingInfo('John', 'Doe', '12345');
    await checkoutPage.continue();
    await checkoutPage.finish();
    
    const completeText = await checkoutPage.getCompleteText();
    expect(completeText).toContain('Thank you for your order');
  });

  test('checkout with performance glitch user', async ({ page }) => {
    // Re-login as performance user
    await page.goto('/');
    const loginPage = new LoginPage(page);
    await loginPage.login(USERS.performance, PASSWORD);
    
    const inventoryPage = new InventoryPage(page);
    await inventoryPage.addToCartByIndex(0);
    await inventoryPage.openCart();
    
    const cartPage = new CartPage(page);
    await cartPage.checkout();
    
    const checkoutPage = new CheckoutPage(page);
    
    // Intentional issue: Performance user is slow, might timeout
    await checkoutPage.fillShippingInfo('Jane', 'Smith', '54321');
    await checkoutPage.continue();
    
    // This might timeout with performance_glitch_user
    await expect(page.locator('.summary_info')).toBeVisible({ timeout: 5000 });
  });

  test('multiple items checkout calculates correct total', async ({ page }) => {
    // Go back and add more items
    await page.goto('/inventory.html');
    
    const inventoryPage = new InventoryPage(page);
    await inventoryPage.addToCartByIndex(1);
    await inventoryPage.addToCartByIndex(3);
    await inventoryPage.openCart();
    
    const cartPage = new CartPage(page);
    await cartPage.checkout();
    
    const checkoutPage = new CheckoutPage(page);
    await checkoutPage.fillShippingInfo('Multi', 'Item', '99999');
    await checkoutPage.continue();
    
    const total = await checkoutPage.getTotal();
    
    // With 4 items, total should be substantial
    expect(total).toBeGreaterThan(50);
  });
});
