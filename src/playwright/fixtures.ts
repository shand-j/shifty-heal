/**
 * Playwright Test Fixtures with Auto-Healing
 *
 * Provides test fixtures that automatically heal broken selectors.
 */

import { test as base, expect as playwrightExpect } from "@playwright/test";
import { HealingEngine } from "../core/healer";
import { HealingConfig } from "../core/types";
import { HealingPage } from "./page-wrapper";
import { RetryHandler } from "./retry-handler";

/**
 * Fixtures available in healing tests
 */
export interface HealingFixtures {
  /** Page with auto-healing capabilities */
  healingPage: HealingPage;
  /** Healing engine instance */
  healingEngine: HealingEngine;
  /** Retry handler for flakiness */
  retryHandler: RetryHandler;
  /** Healing configuration */
  healingConfig: HealingConfig;
}

/**
 * Default healing configuration
 */
const defaultHealingConfig: HealingConfig = {
  enabled: process.env.HEALING_ENABLED !== "false",
  strategies: [
    "data-testid-recovery",
    "text-content-matching",
    "css-hierarchy-analysis",
    "ai-powered-analysis",
  ],
  maxAttempts: parseInt(process.env.HEALING_MAX_ATTEMPTS || "3"),
  cacheHealing: process.env.HEALING_CACHE !== "false",
  ollama: {
    url: process.env.OLLAMA_URL || "http://localhost:11434",
    model: process.env.OLLAMA_MODEL || "qwen2.5-coder:3b",
    timeout: parseInt(process.env.OLLAMA_TIMEOUT || "30000"),
  },
  retry: {
    onTimeout: process.env.RETRY_ON_TIMEOUT !== "false",
    onFlakiness: process.env.RETRY_ON_FLAKINESS !== "false",
    maxRetries: parseInt(process.env.MAX_RETRIES || "2"),
    initialBackoff: parseInt(process.env.INITIAL_BACKOFF || "1000"),
  },
  telemetry: {
    enabled: process.env.TELEMETRY_ENABLED !== "false",
    logLevel: (process.env.LOG_LEVEL as any) || "info",
  },
};

/**
 * Extended Playwright test with healing fixtures
 */
export const healingTest = base.extend<HealingFixtures>({
  healingConfig: [defaultHealingConfig, { option: true }],

  healingEngine: async ({ healingConfig }, use) => {
    const engine = new HealingEngine(healingConfig);
    await use(engine);
  },

  retryHandler: async ({ healingConfig }, use) => {
    const handler = new RetryHandler(healingConfig);
    await use(handler);
  },

  healingPage: async ({ page, healingConfig }, use) => {
    const healingPage = new HealingPage(page, healingConfig);
    await use(healingPage);

    // Log healing stats after test
    const stats = healingPage.getHealingStats();
    if (stats.attempts.size > 0) {
      console.log("\n[Healing Stats]");
      for (const [healing, count] of stats.attempts.entries()) {
        console.log(`  ${healing}: ${count} time(s)`);
      }
    }
  },
});

/**
 * Configure healing for all tests
 */
export function configureHealing(
  config: Partial<HealingConfig>
): typeof healingTest {
  const mergedConfig = { ...defaultHealingConfig, ...config };
  return base.extend<HealingFixtures>({
    healingConfig: [mergedConfig, { option: true }],

    healingEngine: async ({ healingConfig }, use) => {
      const engine = new HealingEngine(healingConfig);
      await use(engine);
    },

    retryHandler: async ({ healingConfig }, use) => {
      const handler = new RetryHandler(healingConfig);
      await use(handler);
    },

    healingPage: async ({ page, healingConfig }, use) => {
      const healingPage = new HealingPage(page, healingConfig);
      await use(healingPage);

      const stats = healingPage.getHealingStats();
      if (stats.attempts.size > 0) {
        console.log("\n[Healing Stats]");
        for (const [healing, count] of stats.attempts.entries()) {
          console.log(`  ${healing}: ${count} time(s)`);
        }
      }
    },
  });
}

/**
 * Enhanced expect with auto-healing support
 */
export const healingExpect = {
  /**
   * Expect locator to be visible with auto-healing
   */
  async toBeVisible(
    healingPage: HealingPage,
    selector: string,
    options?: { timeout?: number }
  ): Promise<void> {
    const locator = await healingPage.locator(selector, options);
    await playwrightExpect(locator).toBeVisible(options);
  },

  /**
   * Expect locator to have text with auto-healing
   */
  async toHaveText(
    healingPage: HealingPage,
    selector: string,
    expected: string | RegExp,
    options?: { timeout?: number }
  ): Promise<void> {
    const locator = await healingPage.locator(selector, options);
    await playwrightExpect(locator).toHaveText(expected, options);
  },

  /**
   * Expect locator to have value with auto-healing
   */
  async toHaveValue(
    healingPage: HealingPage,
    selector: string,
    expected: string | RegExp,
    options?: { timeout?: number }
  ): Promise<void> {
    const locator = await healingPage.locator(selector, options);
    await playwrightExpect(locator).toHaveValue(expected, options);
  },

  /**
   * Expect locator to be enabled with auto-healing
   */
  async toBeEnabled(
    healingPage: HealingPage,
    selector: string,
    options?: { timeout?: number }
  ): Promise<void> {
    const locator = await healingPage.locator(selector, options);
    await playwrightExpect(locator).toBeEnabled(options);
  },

  /**
   * Expect locator to be disabled with auto-healing
   */
  async toBeDisabled(
    healingPage: HealingPage,
    selector: string,
    options?: { timeout?: number }
  ): Promise<void> {
    const locator = await healingPage.locator(selector, options);
    await playwrightExpect(locator).toBeDisabled(options);
  },

  /**
   * Expect locator to be checked with auto-healing
   */
  async toBeChecked(
    healingPage: HealingPage,
    selector: string,
    options?: { timeout?: number }
  ): Promise<void> {
    const locator = await healingPage.locator(selector, options);
    await playwrightExpect(locator).toBeChecked(options);
  },

  /**
   * Expect locator to have count with auto-healing
   */
  async toHaveCount(
    healingPage: HealingPage,
    selector: string,
    expected: number,
    options?: { timeout?: number }
  ): Promise<void> {
    const locator = await healingPage.locator(selector, options);
    await playwrightExpect(locator).toHaveCount(expected, options);
  },
};

/**
 * Re-export Playwright expect for non-healing assertions
 */
export { expect } from "@playwright/test";
