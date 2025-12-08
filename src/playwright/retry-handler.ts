/**
 * Retry Handler for Timeouts and Flakiness
 *
 * Handles intelligent retries for timeout errors and flaky test detection.
 */

import { Page } from "@playwright/test";
import { HealingEngine } from "../core/healer";
import { HealingConfig } from "../core/types";

export interface RetryOptions {
  maxRetries?: number;
  initialBackoff?: number;
  maxBackoff?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export class RetryHandler {
  private engine: HealingEngine;
  private config: Required<HealingConfig>;

  constructor(config: HealingConfig = {}) {
    this.engine = new HealingEngine(config);
    this.config = this.mergeDefaults(config);
  }

  /**
   * Execute an action with automatic retry on timeout/flakiness
   */
  async withRetry<T>(
    action: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const maxRetries: number =
      options.maxRetries ?? this.config.retry.maxRetries ?? 2;
    const initialBackoff: number =
      options.initialBackoff ?? this.config.retry.initialBackoff ?? 1000;
    const maxBackoff: number = options.maxBackoff ?? 10000;

    let lastError: Error | null = null;
    let backoff: number = initialBackoff;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await action();
      } catch (error: any) {
        lastError = error;

        // Check if we should retry
        const shouldRetry = this.shouldRetry(error, attempt, maxRetries);

        if (!shouldRetry) {
          throw error;
        }

        // Call retry callback
        if (options.onRetry) {
          options.onRetry(attempt + 1, error);
        }

        // Wait before retrying with exponential backoff
        if (attempt < maxRetries) {
          await this.delay(backoff);
          backoff = Math.min(backoff * 2, maxBackoff);
        }
      }
    }

    throw lastError || new Error("Max retries exceeded");
  }

  /**
   * Execute a Playwright action with healing and retry
   */
  async executeWithHealing<T>(
    page: Page,
    selector: string,
    action: (locator: any) => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    return this.withRetry(async () => {
      try {
        const locator = page.locator(selector);
        return await action(locator);
      } catch (error: any) {
        // If action fails, try healing the selector
        if (this.isLocatorError(error)) {
          const healingResult = await this.engine.heal(page, selector);

          if (healingResult.success) {
            const healedLocator = page.locator(healingResult.selector);
            return await action(healedLocator);
          }
        }
        throw error;
      }
    }, options);
  }

  /**
   * Determine if an error should trigger a retry
   */
  private shouldRetry(
    error: Error,
    attempt: number,
    maxRetries: number
  ): boolean {
    if (attempt >= maxRetries) {
      return false;
    }

    const errorMessage = error.message.toLowerCase();

    // Retry on timeout errors
    if (this.config.retry.onTimeout) {
      const timeoutPatterns = [
        "timeout",
        "timed out",
        "waiting for selector",
        "waiting for element",
        "exceeded timeout",
      ];

      if (timeoutPatterns.some((pattern) => errorMessage.includes(pattern))) {
        return true;
      }
    }

    // Retry on network errors
    const networkPatterns = [
      "net::err",
      "network error",
      "connection refused",
      "econnrefused",
      "socket hang up",
    ];

    if (networkPatterns.some((pattern) => errorMessage.includes(pattern))) {
      return true;
    }

    // Retry on element state errors (potential flakiness)
    if (this.config.retry.onFlakiness) {
      const flakyPatterns = [
        "element is not visible",
        "element is not attached",
        "element is not stable",
        "intercepts pointer events",
        "not actionable",
      ];

      if (flakyPatterns.some((pattern) => errorMessage.includes(pattern))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if error is a locator/selector error
   */
  private isLocatorError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    const locatorPatterns = [
      "locator",
      "selector",
      "element not found",
      "no element matches",
      "could not find",
    ];

    return locatorPatterns.some((pattern) => errorMessage.includes(pattern));
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Merge with defaults
   */
  private mergeDefaults(config: HealingConfig): Required<HealingConfig> {
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
}
