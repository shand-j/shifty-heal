/**
 * @shifty/playwright-healing
 * 
 * Autonomous selector healing engine for Playwright tests.
 * Automatically fixes broken selectors using multiple strategies including AI-powered analysis.
 */

// Core healing engine
export { HealingEngine } from './core/healer';
export { HealingResult, HealingConfig, HealingStrategy, ElementInfo } from './core/types';

// Healing strategies
export { DataTestIdRecoveryStrategy } from './core/strategies/data-testid-recovery';
export { TextContentMatchingStrategy } from './core/strategies/text-content-matching';
export { CssHierarchyAnalysisStrategy } from './core/strategies/css-hierarchy-analysis';
export { AiPoweredAnalysisStrategy } from './core/strategies/ai-powered-analysis';

// Playwright integration
export { HealingPage } from './playwright/page-wrapper';
export { RetryHandler } from './playwright/retry-handler';
export {
  healingTest,
  healingExpect,
  configureHealing,
  HealingFixtures,
} from './playwright/fixtures';

// Configuration
export {
  loadHealingConfig,
  getDefaultConfig,
  validateConfig,
} from './config/healing-config';

// Re-export commonly used Playwright types
export { expect } from '@playwright/test';
export type { Page, Locator, TestInfo } from '@playwright/test';
