/**
 * Basic Usage Example
 * 
 * Demonstrates how to use the healing engine in Playwright tests.
 */

import { healingTest, expect } from '../src';

healingTest.describe('Login Flow with Auto-Healing', () => {
  healingTest('should login successfully even with broken selectors', async ({
    healingPage,
  }) => {
    // Navigate to login page
    await healingPage.goto('https://example.com/login');

    // These selectors might be broken, but healing will fix them automatically
    await healingPage.fill('#username-field', 'user@example.com');
    await healingPage.fill('#password-input', 'SecurePassword123!');
    await healingPage.click('button[type="submit"]');

    // Verify login success
    const welcomeLocator = await healingPage.locator('.welcome-message');
    await expect(welcomeLocator).toBeVisible();
  });

  healingTest('should handle dynamic selectors', async ({ healingPage }) => {
    await healingPage.goto('https://example.com/dashboard');

    // Even if the ID changes, healing will find the element
    await healingPage.click('#dynamic-button-12345');

    // Text-based healing works great for buttons
    await healingPage.click('button:has-text("Save Changes")');
  });
});

healingTest.describe('Advanced Configuration', () => {
  healingTest('should use specific healing strategies', async ({
    page,
    healingConfig,
  }) => {
    // Use only data-testid and text matching (skip AI)
    healingConfig.strategies = ['data-testid-recovery', 'text-content-matching'];

    const healingPage = new (await import('../src')).HealingPage(page, healingConfig);

    await healingPage.goto('https://example.com');
    await healingPage.click('[data-testid="submit-btn"]');
  });

  healingTest('should report healing statistics', async ({ healingPage }) => {
    await healingPage.goto('https://example.com');
    
    // Perform actions
    await healingPage.click('#broken-selector-1');
    await healingPage.fill('#broken-selector-2', 'test');
    
    // Get statistics
    const stats = healingPage.getHealingStats();
    console.log('Healing attempts:', stats.attempts);
    console.log('Flakiness detected:', stats.flakiness);
  });
});
