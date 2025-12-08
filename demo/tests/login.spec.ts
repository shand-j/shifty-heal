import { test, expect } from '@playwright/test';
import { USERS, PASSWORD, LoginPage } from './fixtures';

test.describe('Login Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('successful login with standard user', async ({ page }) => {
    const loginPage = new LoginPage(page);
    
    await loginPage.login(USERS.standard, PASSWORD);
    
    // Intentional issue: Fragile selector that might need healing
    await expect(page.locator('.inventory_list')).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/.*inventory/);
  });

  test('locked out user cannot login', async ({ page }) => {
    const loginPage = new LoginPage(page);
    
    await loginPage.login(USERS.locked, PASSWORD);
    
    const error = await loginPage.getErrorMessage();
    expect(error).toContain('locked out');
    expect(await loginPage.isLoginButtonVisible()).toBe(true);
  });

  test('invalid credentials show error', async ({ page }) => {
    const loginPage = new LoginPage(page);
    
    await loginPage.login('invalid_user', 'wrong_password');
    
    // Intentional issue: Selector might timeout
    const error = await page.locator('[data-test="error"]').textContent({ timeout: 5000 });
    expect(error).toContain('Username and password do not match');
  });

  test('empty username shows validation error', async ({ page }) => {
    const loginPage = new LoginPage(page);
    
    await loginPage.login('', PASSWORD);
    
    const error = await loginPage.getErrorMessage();
    expect(error).toContain('Username is required');
  });

  test('empty password shows validation error', async ({ page }) => {
    const loginPage = new LoginPage(page);
    
    await loginPage.login(USERS.standard, '');
    
    const error = await loginPage.getErrorMessage();
    expect(error).toContain('Password is required');
  });

  test('performance glitch user login is slow', async ({ page }) => {
    const loginPage = new LoginPage(page);
    
    // Intentional issue: Timeout might be too short for performance_glitch_user
    await loginPage.login(USERS.performance, PASSWORD);
    
    // This might timeout and need healing
    await expect(page.locator('.inventory_list')).toBeVisible({ timeout: 8000 });
  });

  test('problem user can login', async ({ page }) => {
    const loginPage = new LoginPage(page);
    
    await loginPage.login(USERS.problem, PASSWORD);
    
    await expect(page).toHaveURL(/.*inventory/);
    // Problem user has broken images, but login works
    await expect(page.locator('.inventory_item')).toHaveCount(6);
  });

  test('visual user can login', async ({ page }) => {
    const loginPage = new LoginPage(page);
    
    await loginPage.login(USERS.visual, PASSWORD);
    
    await expect(page).toHaveURL(/.*inventory/);
    await expect(page.locator('.title')).toHaveText('Products');
  });

  test('error user can login', async ({ page }) => {
    const loginPage = new LoginPage(page);
    
    await loginPage.login(USERS.error, PASSWORD);
    
    // Intentional issue: Brittle selector
    await expect(page.locator('.app_logo')).toBeVisible();
  });
});
