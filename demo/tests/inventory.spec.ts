import { test, expect } from '@playwright/test';
import { USERS, PASSWORD, LoginPage, InventoryPage } from './fixtures';

test.describe('Inventory Tests', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await page.goto('/');
    await loginPage.login(USERS.standard, PASSWORD);
  });

  test('displays all products', async ({ page }) => {
    const inventoryPage = new InventoryPage(page);
    
    const count = await inventoryPage.getProductCount();
    expect(count).toBe(6);
  });

  test('add single product to cart', async ({ page }) => {
    const inventoryPage = new InventoryPage(page);
    
    await inventoryPage.addToCartByIndex(0);
    
    const badge = await inventoryPage.getCartBadgeCount();
    expect(badge).toBe(1);
  });

  test('add multiple products to cart', async ({ page }) => {
    const inventoryPage = new InventoryPage(page);
    
    await inventoryPage.addToCartByIndex(0);
    await inventoryPage.addToCartByIndex(2);
    await inventoryPage.addToCartByIndex(4);
    
    // Intentional issue: Might have timing issues
    await page.waitForTimeout(500);
    
    const badge = await inventoryPage.getCartBadgeCount();
    expect(badge).toBe(3);
  });

  test('sort products by name A-Z', async ({ page }) => {
    const inventoryPage = new InventoryPage(page);
    
    await inventoryPage.sortProducts('az');
    
    // Intentional issue: Race condition - DOM might not be updated
    const firstName = await inventoryPage.getFirstProductName();
    expect(firstName).toContain('Backpack');
  });

  test('sort products by name Z-A', async ({ page }) => {
    const inventoryPage = new InventoryPage(page);
    
    await inventoryPage.sortProducts('za');
    
    const firstName = await inventoryPage.getFirstProductName();
    expect(firstName).toContain('Test.allTheThings()');
  });

  test('sort products by price low to high', async ({ page }) => {
    const inventoryPage = new InventoryPage(page);
    
    // Intentional issue: Selector might be fragile
    await page.locator('.product_sort_container').selectOption('lohi');
    
    await expect(page.locator('.inventory_item').first()).toContainText('$7.99');
  });

  test('sort products by price high to low', async ({ page }) => {
    const inventoryPage = new InventoryPage(page);
    
    await inventoryPage.sortProducts('hilo');
    
    // Intentional timeout issue
    await expect(page.locator('.inventory_item').first()).toContainText('$49.99', { timeout: 3000 });
  });

  test('product details page navigation', async ({ page }) => {
    // Intentional issue: Brittle selector
    await page.locator('.inventory_item_name').first().click();
    
    await expect(page).toHaveURL(/.*inventory-item/);
    await expect(page.locator('.inventory_details_name')).toBeVisible();
  });

  test('add to cart from product details', async ({ page }) => {
    await page.locator('.inventory_item_name').first().click();
    
    // Intentional issue: ID selector might change
    await page.locator('#add-to-cart-sauce-labs-backpack').click();
    
    const badge = await page.locator('.shopping_cart_badge').textContent();
    expect(badge).toBe('1');
  });

  test('cart button navigation', async ({ page }) => {
    const inventoryPage = new InventoryPage(page);
    
    await inventoryPage.openCart();
    
    await expect(page).toHaveURL(/.*cart/);
    await expect(page.locator('.title')).toHaveText('Your Cart');
  });

  test('problem user sees broken product images', async ({ page }) => {
    // Re-login as problem user
    await page.goto('/');
    const loginPage = new LoginPage(page);
    await loginPage.login(USERS.problem, PASSWORD);
    
    // Intentional issue: Image validation might be flaky
    const firstImage = page.locator('.inventory_item_img').first();
    await expect(firstImage).toBeVisible();
    
    const src = await firstImage.getAttribute('src');
    // Problem user has broken images
    expect(src).toBeTruthy();
  });
});
