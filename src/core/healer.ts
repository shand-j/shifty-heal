/**
 * Main Healing Engine
 *
 * Orchestrates all healing strategies to automatically fix broken selectors.
 */

import { Page } from "@playwright/test";
import { AiPoweredAnalysisStrategy } from "./strategies/ai-powered-analysis";
import { CssHierarchyAnalysisStrategy } from "./strategies/css-hierarchy-analysis";
import { DataTestIdRecoveryStrategy } from "./strategies/data-testid-recovery";
import { TextContentMatchingStrategy } from "./strategies/text-content-matching";
import {
  HealingCacheEntry,
  HealingConfig,
  HealingResult,
  HealingStrategy,
  HealingStrategyOptions,
} from "./types";

export class HealingEngine {
  private config: Required<HealingConfig>;
  private strategies: Map<HealingStrategy, any>;
  private cache: Map<string, HealingCacheEntry>;
  private flakinessTracker: Map<
    string,
    { successes: number; failures: number }
  >;

  constructor(config: HealingConfig = {}) {
    this.config = this.mergeWithDefaults(config);
    this.strategies = new Map();
    this.cache = new Map();
    this.flakinessTracker = new Map();

    this.initializeStrategies();
  }

  /**
   * Attempt to heal a broken selector
   */
  async heal(
    page: Page,
    brokenSelector: string,
    options: HealingStrategyOptions = {}
  ): Promise<HealingResult> {
    if (!this.config.enabled) {
      return {
        success: false,
        selector: brokenSelector,
        confidence: 0,
        strategy: "data-testid-recovery",
        alternatives: [],
        error: "Healing is disabled",
      };
    }

    // Check cache first
    if (this.config.cacheHealing) {
      const cached = this.cache.get(brokenSelector);
      if (cached) {
        cached.useCount++;
        this.log(
          "debug",
          `Using cached healing for "${brokenSelector}" -> "${cached.healed}"`
        );

        // Verify cached selector still works
        const exists = await this.checkSelectorExists(page, cached.healed);
        if (exists) {
          return {
            success: true,
            selector: cached.healed,
            confidence: cached.confidence,
            strategy: cached.strategy,
            alternatives: [],
            metadata: { cached: true, useCount: cached.useCount },
          };
        } else {
          // Cached selector no longer works, remove from cache
          this.cache.delete(brokenSelector);
          this.log(
            "warn",
            `Cached healing for "${brokenSelector}" no longer works`
          );
        }
      }
    }

    // Check if selector already works
    const exists = await this.checkSelectorExists(page, brokenSelector);
    if (exists) {
      this.trackSuccess(brokenSelector);
      return {
        success: true,
        selector: brokenSelector,
        confidence: 1.0,
        strategy: "data-testid-recovery",
        alternatives: [],
        metadata: { noHealingNeeded: true },
      };
    }

    this.log("info", `Attempting to heal selector: "${brokenSelector}"`);

    // Try each strategy in order
    const strategies = this.config.strategies;
    let lastResult: HealingResult | null = null;

    for (let attempt = 0; attempt < this.config.maxAttempts; attempt++) {
      for (const strategyName of strategies) {
        const strategy = this.strategies.get(strategyName);
        if (!strategy) {
          this.log("warn", `Strategy "${strategyName}" not found`);
          continue;
        }

        this.log(
          "debug",
          `Trying strategy: ${strategyName} (attempt ${attempt + 1})`
        );

        try {
          const result = await strategy.heal(page, brokenSelector, options);
          lastResult = result;

          if (result.success) {
            this.log(
              "info",
              `✅ Healed using ${strategyName}: "${brokenSelector}" -> "${result.selector}"`
            );

            // Cache successful healing
            if (this.config.cacheHealing) {
              this.cache.set(brokenSelector, {
                original: brokenSelector,
                healed: result.selector,
                confidence: result.confidence,
                strategy: strategyName,
                timestamp: new Date(),
                useCount: 1,
              });
            }

            this.trackSuccess(result.selector);
            return result;
          }
        } catch (error: any) {
          this.log(
            "error",
            `Strategy ${strategyName} failed: ${error.message}`
          );
        }
      }

      // If we've tried all strategies and failed, break
      if (attempt < this.config.maxAttempts - 1) {
        this.log(
          "debug",
          `All strategies failed, retrying (attempt ${attempt + 2})`
        );
        await this.delay(1000 * (attempt + 1)); // Exponential backoff
      }
    }

    this.trackFailure(brokenSelector);
    this.log("error", `❌ Failed to heal selector: "${brokenSelector}"`);

    return (
      lastResult || {
        success: false,
        selector: brokenSelector,
        confidence: 0,
        strategy: "data-testid-recovery",
        alternatives: [],
        error: "All healing strategies failed",
      }
    );
  }

  /**
   * Get health status of the healing engine
   */
  async healthCheck(): Promise<{
    status: "healthy" | "degraded" | "offline";
    strategies: Record<HealingStrategy, boolean>;
    cache: { size: number; entries: number };
  }> {
    const strategyHealth: Record<string, boolean> = {};

    // Check AI strategy (Ollama availability)
    if (this.strategies.has("ai-powered-analysis")) {
      try {
        const response = await fetch(
          `${this.config.ollama?.url || "http://localhost:11434"}/api/tags`,
          { method: "GET", signal: AbortSignal.timeout(5000) }
        );
        strategyHealth["ai-powered-analysis"] = response.ok;
      } catch {
        strategyHealth["ai-powered-analysis"] = false;
      }
    }

    // Other strategies are always available
    strategyHealth["data-testid-recovery"] = true;
    strategyHealth["text-content-matching"] = true;
    strategyHealth["css-hierarchy-analysis"] = true;

    const allHealthy = Object.values(strategyHealth).every((v) => v);
    const someHealthy = Object.values(strategyHealth).some((v) => v);

    return {
      status: allHealthy ? "healthy" : someHealthy ? "degraded" : "offline",
      strategies: strategyHealth as Record<HealingStrategy, boolean>,
      cache: {
        size: this.cache.size,
        entries: Array.from(this.cache.values()).reduce(
          (sum, e) => sum + e.useCount,
          0
        ),
      },
    };
  }

  /**
   * Get flakiness statistics
   */
  getFlakinessStats(): Array<{
    selector: string;
    successes: number;
    failures: number;
    flakinessScore: number;
  }> {
    const stats: Array<{
      selector: string;
      successes: number;
      failures: number;
      flakinessScore: number;
    }> = [];

    for (const [selector, data] of this.flakinessTracker.entries()) {
      const total = data.successes + data.failures;
      const flakinessScore = total > 0 ? data.failures / total : 0;

      if (flakinessScore > 0) {
        stats.push({
          selector,
          successes: data.successes,
          failures: data.failures,
          flakinessScore,
        });
      }
    }

    return stats.sort((a, b) => b.flakinessScore - a.flakinessScore);
  }

  /**
   * Clear the healing cache
   */
  clearCache(): void {
    this.cache.clear();
    this.log("info", "Healing cache cleared");
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<HealingConfig>): void {
    this.config = this.mergeWithDefaults({ ...this.config, ...config });
    this.initializeStrategies(); // Reinitialize with new config
  }

  /**
   * Initialize healing strategies
   */
  private initializeStrategies(): void {
    this.strategies.clear();

    this.strategies.set(
      "data-testid-recovery",
      new DataTestIdRecoveryStrategy()
    );
    this.strategies.set(
      "text-content-matching",
      new TextContentMatchingStrategy()
    );
    this.strategies.set(
      "css-hierarchy-analysis",
      new CssHierarchyAnalysisStrategy()
    );
    this.strategies.set(
      "ai-powered-analysis",
      new AiPoweredAnalysisStrategy({
        ollamaUrl: this.config.ollama?.url,
        model: this.config.ollama?.model,
        timeout: this.config.ollama?.timeout,
      })
    );
  }

  /**
   * Merge config with defaults
   */
  private mergeWithDefaults(config: HealingConfig): Required<HealingConfig> {
    return {
      enabled: config.enabled ?? true,
      strategies: config.strategies ?? [
        "data-testid-recovery",
        "text-content-matching",
        "css-hierarchy-analysis",
        "ai-powered-analysis",
      ],
      maxAttempts: config.maxAttempts ?? 3,
      cacheHealing: config.cacheHealing ?? true,
      ollama: {
        url: config.ollama?.url ?? "http://localhost:11434",
        model: config.ollama?.model ?? "qwen2.5-coder:3b",
        timeout: config.ollama?.timeout ?? 30000,
      },
      retry: {
        onTimeout: config.retry?.onTimeout ?? true,
        onFlakiness: config.retry?.onFlakiness ?? true,
        maxRetries: config.retry?.maxRetries ?? 2,
        initialBackoff: config.retry?.initialBackoff ?? 1000,
      },
      telemetry: {
        enabled: config.telemetry?.enabled ?? true,
        logLevel: config.telemetry?.logLevel ?? "info",
      },
    };
  }

  /**
   * Check if selector exists
   */
  private async checkSelectorExists(
    page: Page,
    selector: string
  ): Promise<boolean> {
    try {
      const count = await page.locator(selector).count();
      return count > 0;
    } catch {
      return false;
    }
  }

  /**
   * Track successful selector usage
   */
  private trackSuccess(selector: string): void {
    const stats = this.flakinessTracker.get(selector) || {
      successes: 0,
      failures: 0,
    };
    stats.successes++;
    this.flakinessTracker.set(selector, stats);
  }

  /**
   * Track failed selector usage
   */
  private trackFailure(selector: string): void {
    const stats = this.flakinessTracker.get(selector) || {
      successes: 0,
      failures: 0,
    };
    stats.failures++;
    this.flakinessTracker.set(selector, stats);
  }

  /**
   * Logging utility
   */
  private log(
    level: "debug" | "info" | "warn" | "error",
    message: string
  ): void {
    if (!this.config.telemetry?.enabled) return;

    const levels = ["debug", "info", "warn", "error"];
    const configLevel = this.config.telemetry?.logLevel || "info";

    if (levels.indexOf(level) >= levels.indexOf(configLevel)) {
      const prefix = `[HealingEngine:${level.toUpperCase()}]`;
      console[level === "debug" ? "log" : level](`${prefix} ${message}`);
    }
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
