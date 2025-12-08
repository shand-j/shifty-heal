/**
 * Auto-Healing Page Wrapper
 * 
 * Wraps Playwright Page with automatic selector healing capabilities.
 */

import { Page, Locator } from '@playwright/test';
import { HealingEngine } from '../core/healer';
import { HealingConfig } from '../core/types';

export class HealingPage {
  private page: Page;
  private engine: HealingEngine;
  private healingAttempts: Map<string, number>;

  constructor(page: Page, config: HealingConfig = {}) {
    this.page = page;
    this.engine = new HealingEngine(config);
    this.healingAttempts = new Map();
  }

  /**
   * Get a locator with auto-healing support
   */
  async locator(selector: string, options?: { timeout?: number }): Promise<Locator> {
    try {
      const locator = this.page.locator(selector);
      
      // Try to wait for the element briefly
      await locator.first().waitFor({ 
        state: 'attached', 
        timeout: options?.timeout || 5000 
      });
      
      return locator;
    } catch (error) {
      // Element not found, try healing
      const healingResult = await this.engine.heal(this.page, selector);
      
      if (healingResult.success) {
        this.trackHealing(selector, healingResult.selector);
        return this.page.locator(healingResult.selector);
      }
      
      // Healing failed, return original locator (will throw proper error)
      throw error;
    }
  }

  /**
   * Navigate with telemetry
   */
  async goto(url: string, options?: Parameters<Page['goto']>[1]): Promise<any> {
    return this.page.goto(url, options);
  }

  /**
   * Click with auto-healing
   */
  async click(selector: string, options?: Parameters<Locator['click']>[0]): Promise<void> {
    const locator = await this.locator(selector);
    await locator.click(options);
  }

  /**
   * Fill with auto-healing
   */
  async fill(
    selector: string,
    value: string,
    options?: Parameters<Locator['fill']>[1]
  ): Promise<void> {
    const locator = await this.locator(selector);
    await locator.fill(value, options);
  }

  /**
   * Type with auto-healing
   */
  async type(
    selector: string,
    text: string,
    options?: Parameters<Locator['type']>[1]
  ): Promise<void> {
    const locator = await this.locator(selector);
    await locator.type(text, options);
  }

  /**
   * Select option with auto-healing
   */
  async selectOption(
    selector: string,
    values: string | string[],
    options?: Parameters<Locator['selectOption']>[1]
  ): Promise<string[]> {
    const locator = await this.locator(selector);
    return await locator.selectOption(values, options);
  }

  /**
   * Check with auto-healing
   */
  async check(selector: string, options?: Parameters<Locator['check']>[0]): Promise<void> {
    const locator = await this.locator(selector);
    await locator.check(options);
  }

  /**
   * Uncheck with auto-healing
   */
  async uncheck(selector: string, options?: Parameters<Locator['uncheck']>[0]): Promise<void> {
    const locator = await this.locator(selector);
    await locator.uncheck(options);
  }

  /**
   * Wait for selector with auto-healing
   */
  async waitForSelector(
    selector: string,
    options?: Parameters<Page['waitForSelector']>[1]
  ): Promise<any> {
    try {
      return await this.page.waitForSelector(selector, options || {});
    } catch (error) {
      const healingResult = await this.engine.heal(this.page, selector);
      if (healingResult.success) {
        this.trackHealing(selector, healingResult.selector);
        return await this.page.waitForSelector(healingResult.selector, options || {});
      }
      throw error;
    }
  }

  /**
   * Screenshot with metadata
   */
  async screenshot(options?: Parameters<Page['screenshot']>[0]): Promise<Buffer> {
    return await this.page.screenshot(options);
  }

  /**
   * Get the underlying Playwright Page
   */
  getPage(): Page {
    return this.page;
  }

  /**
   * Get healing engine
   */
  getEngine(): HealingEngine {
    return this.engine;
  }

  /**
   * Get healing statistics
   */
  getHealingStats(): {
    attempts: Map<string, number>;
    flakiness: ReturnType<HealingEngine['getFlakinessStats']>;
  } {
    return {
      attempts: new Map(this.healingAttempts),
      flakiness: this.engine.getFlakinessStats(),
    };
  }

  /**
   * Clear healing cache
   */
  clearHealingCache(): void {
    this.engine.clearCache();
    this.healingAttempts.clear();
  }

  /**
   * Track healing attempts
   */
  private trackHealing(original: string, healed: string): void {
    const key = `${original} -> ${healed}`;
    const count = this.healingAttempts.get(key) || 0;
    this.healingAttempts.set(key, count + 1);
  }
}
