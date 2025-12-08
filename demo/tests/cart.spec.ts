import { test, expect } from '@playwright/test';
import { USERS, PASSWORD, LoginPage, InventoryPage, CartPage } from './fixtures';

test.describe('Shopping Cart Tests', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    const inventoryPage = new InventoryPage(page);
    
    await page.goto('/');
    await loginPage.login(USERS.standard, PASSWORD);
    
    // Add items to cart for testing
    await inventoryPage.addToCartByIndex(0);
    await inventoryPage.addToCartByIndex(1);
    await inventoryPage.openCart();
  });

  test('displays items in cart', async ({ page }) => {
    const cartPage = new CartPage(page);
    
    const count = await cartPage.getItemCount();
    expect(count).toBe(2);
  });

  test('remove item from cart', async ({ page }) => {
    const cartPage = new CartPage(page);
    
    await cartPage.removeItem(0);
    
    // Intentional issue: Might need to wait for DOM update
    const count = await cartPage.getItemCount();
    expect(count).toBe(1);
  });

  test('continue shopping returns to inventory', async ({ page }) => {
    const cartPage = new CartPage(page);
    
    await cartPage.continueShopping();
    
    await expect(page).toHaveURL(/.*inventory/);
  });

  test('checkout button navigation', async ({ page }) => {
    const cartPage = new CartPage(page);
    
    // Intentional issue: Race condition
    await cartPage.checkout();
    
    await expect(page).toHaveURL(/.*checkout-step-one/);
  });

  test('empty cart shows no items', async ({ page }) => {
    const cartPage = new CartPage(page);
    
    await cartPage.removeItem(0);
    await cartPage.removeItem(0);
    
    const count = await cartPage.getItemCount();
    expect(count).toBe(0);
  });

  test('cart badge updates when items removed', async ({ page }) => {
    const cartPage = new CartPage(page);
    
    await cartPage.removeItem(0);
    
    // Intentional issue: Selector might be fragile
    await page.locator('#continue-shopping').click();
    
    const badge = await page.locator('.shopping_cart_badge').textContent();
    expect(badge).toBe('1');
  });

  test('cart preserves items across navigation', async ({ page }) => {
    const cartPage = new CartPage(page);
    
    await cartPage.continueShopping();
    
    // Add another item
    await page.locator('.inventory_item').nth(2).locator('button').click();
    
    // Go back to cart
    await page.locator('.shopping_cart_link').click();
    
    const count = await cartPage.getItemCount();
    expect(count).toBe(3);
  });

  test('cart item names match inventory', async ({ page }) => {
    const cartPage = new CartPage(page);
    
    const itemNames = await cartPage.getItemNames();
    
    expect(itemNames.length).toBe(2);
    expect(itemNames[0]).toBeTruthy();
  });

  test('remove all items individually', async ({ page }) => {
    const cartPage = new CartPage(page);
    
    // Intentional issue: Loop might have timing issues
    const initialCount = await cartPage.getItemCount();
    
    for (let i = 0; i < initialCount; i++) {
      await cartPage.removeItem(0);
    }
    
    const finalCount = await cartPage.getItemCount();
    expect(finalCount).toBe(0);
  });
});
