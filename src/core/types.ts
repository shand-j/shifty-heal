/**
 * Core types for the Playwright Healing Engine
 */

import { Page } from '@playwright/test';

/**
 * Result of a healing attempt
 */
export interface HealingResult {
  /** Whether healing was successful */
  success: boolean;
  /** The healed selector (or original if failed) */
  selector: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Strategy used for healing */
  strategy: HealingStrategy;
  /** Alternative selectors that could work */
  alternatives: string[];
  /** Error message if healing failed */
  error?: string;
  /** Metadata about the healing process */
  metadata?: Record<string, any>;
}

/**
 * Available healing strategies
 */
export type HealingStrategy =
  | 'data-testid-recovery'
  | 'text-content-matching'
  | 'css-hierarchy-analysis'
  | 'ai-powered-analysis';

/**
 * Configuration for the healing engine
 */
export interface HealingConfig {
  /** Enable/disable healing */
  enabled?: boolean;
  /** Strategies to use (in order of preference) */
  strategies?: HealingStrategy[];
  /** Maximum attempts per selector */
  maxAttempts?: number;
  /** Cache healed selectors */
  cacheHealing?: boolean;
  /** Ollama configuration for AI-powered healing */
  ollama?: {
    url?: string;
    model?: string;
    timeout?: number;
  };
  /** Retry configuration */
  retry?: {
    /** Retry on timeout errors */
    onTimeout?: boolean;
    /** Retry on flaky test detection */
    onFlakiness?: boolean;
    /** Maximum retries */
    maxRetries?: number;
    /** Initial backoff in ms */
    initialBackoff?: number;
  };
  /** Telemetry configuration */
  telemetry?: {
    enabled?: boolean;
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
  };
}

/**
 * Element information extracted from the page
 */
export interface ElementInfo {
  tag: string;
  id?: string;
  classes: string[];
  text?: string;
  testId?: string;
  role?: string;
  ariaLabel?: string;
  type?: string;
  name?: string;
  xpath?: string;
  parent?: {
    tag: string;
    classes: string[];
  };
  siblings?: number;
}

/**
 * Base interface for healing strategies
 */
export interface HealingStrategyInterface {
  /**
   * Name of the strategy
   */
  readonly name: HealingStrategy;

  /**
   * Attempt to heal a broken selector
   */
  heal(
    page: Page,
    brokenSelector: string,
    options?: HealingStrategyOptions
  ): Promise<HealingResult>;

  /**
   * Check if this strategy can handle the selector
   */
  canHandle(selector: string): boolean;
}

/**
 * Options for healing strategies
 */
export interface HealingStrategyOptions {
  /** Expected element type (button, input, etc.) */
  expectedType?: string;
  /** Maximum number of elements to analyze */
  maxElements?: number;
  /** Timeout for the healing operation */
  timeout?: number;
  /** Additional context */
  context?: Record<string, any>;
}

/**
 * Flakiness tracking data
 */
export interface FlakinessData {
  selector: string;
  attempts: number;
  successes: number;
  failures: number;
  lastFailure?: Date;
  flakinessScore: number;
}

/**
 * Retry context for handling timeouts
 */
export interface RetryContext {
  attempt: number;
  maxAttempts: number;
  backoff: number;
  lastError?: Error;
}

/**
 * Healing cache entry
 */
export interface HealingCacheEntry {
  original: string;
  healed: string;
  confidence: number;
  strategy: HealingStrategy;
  timestamp: Date;
  useCount: number;
}
