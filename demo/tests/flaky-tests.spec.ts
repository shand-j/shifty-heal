import { test, expect } from '@playwright/test';
import { USERS, PASSWORD, LoginPage, InventoryPage } from './fixtures';

/**
 * These tests intentionally demonstrate flakiness patterns that Shifty Heal can detect and fix
 */
test.describe('Flaky Tests - Demonstrating Healing Capabilities', () => {
  
  test('flaky timeout - too short wait', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await page.goto('/');
    await loginPage.login(USERS.standard, PASSWORD);
    
    // Intentional issue: Timeout too short, might fail randomly
    await expect(page.locator('.inventory_list')).toBeVisible({ timeout: 1000 });
  });

  test('flaky race condition - clicking too fast', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const inventoryPage = new InventoryPage(page);
    
    await page.goto('/');
    await loginPage.login(USERS.standard, PASSWORD);
    
    // Intentional issue: Clicking before DOM is fully ready
    await inventoryPage.addToCartByIndex(0);
    
    // No wait - race condition
    const badge = await inventoryPage.getCartBadgeCount();
    expect(badge).toBe(1);
  });

  test('flaky selector - brittle locator', async ({ page }) => {
    await page.goto('/');
    
    // Intentional issue: Using nth-child which might change
    await page.locator('form > div:nth-child(1) > input').fill(USERS.standard);
    await page.locator('form > div:nth-child(2) > input').fill(PASSWORD);
    await page.locator('form > input[type="submit"]').click();
    
    await expect(page).toHaveURL(/.*inventory/);
  });

  test('flaky async operation - missing await', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await page.goto('/');
    await loginPage.login(USERS.standard, PASSWORD);
    
    // Intentional issue: Multiple async operations without proper waiting
    const productCount = page.locator('.inventory_item').count();
    const cartBadge = page.locator('.shopping_cart_badge').count();
    
    // These might not be resolved when we check
    expect(await productCount).toBe(6);
    expect(await cartBadge).toBe(0);
  });

  test('flaky state pollution - depends on previous test', async ({ page }) => {
    // Intentional issue: Assumes cart might have items from previous tests
    // This is flaky if test isolation fails
    
    await page.goto('/');
    const loginPage = new LoginPage(page);
    await loginPage.login(USERS.standard, PASSWORD);
    
    // Assumes clean state but might fail if cart has items
    const badge = await page.locator('.shopping_cart_badge').count();
    expect(badge).toBe(0);
  });

  test('flaky timing - hardcoded wait', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await page.goto('/');
    await loginPage.login(USERS.performance, PASSWORD);
    
    // Intentional issue: Hardcoded wait instead of proper waiting strategy
    await page.waitForTimeout(2000);
    
    // Might fail if performance_glitch_user takes longer
    const products = await page.locator('.inventory_item').count();
    expect(products).toBe(6);
  });

  test('flaky network-dependent test', async ({ page }) => {
    await page.goto('/');
    
    // Intentional issue: No network idle wait
    const loginPage = new LoginPage(page);
    await loginPage.login(USERS.standard, PASSWORD);
    
    // Click immediately without waiting for page to be ready
    await page.locator('.inventory_item').first().click();
    
    // Might fail on slow networks
    await expect(page.locator('.inventory_details_name')).toBeVisible({ timeout: 2000 });
  });

  test('flaky element not stable', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const inventoryPage = new InventoryPage(page);
    
    await page.goto('/');
    await loginPage.login(USERS.standard, PASSWORD);
    
    // Intentional issue: Sorting might cause elements to move while clicking
    await inventoryPage.sortProducts('za');
    
    // Clicking immediately after sort - element might be animating
    await page.locator('.inventory_item').first().locator('button').click();
    
    const badge = await inventoryPage.getCartBadgeCount();
    expect(badge).toBe(1);
  });

  test('flaky detached element', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await page.goto('/');
    await loginPage.login(USERS.standard, PASSWORD);
    
    // Get element reference
    const firstProduct = page.locator('.inventory_item').first();
    
    // Intentional issue: Sort causes DOM to change
    await page.locator('.product_sort_container').selectOption('za');
    
    // Element might be detached after sort
    await firstProduct.locator('button').click();
  });

  test('flaky concurrent operations', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const inventoryPage = new InventoryPage(page);
    
    await page.goto('/');
    await loginPage.login(USERS.standard, PASSWORD);
    
    // Intentional issue: Multiple operations without proper sequencing
    await Promise.all([
      inventoryPage.addToCartByIndex(0),
      inventoryPage.addToCartByIndex(1),
      inventoryPage.addToCartByIndex(2),
    ]);
    
    // Badge count might not be updated
    const badge = await inventoryPage.getCartBadgeCount();
    expect(badge).toBe(3);
  });
});
