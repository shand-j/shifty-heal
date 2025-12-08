/**
 * Data Test ID Recovery Strategy
 * 
 * Scans the page DOM for elements with data-testid, data-test-id, or data-cy attributes.
 * Finds similar test IDs and suggests alternatives based on proximity and context.
 */

import { Page } from '@playwright/test';
import {
  HealingResult,
  HealingStrategyInterface,
  HealingStrategyOptions,
  ElementInfo,
} from '../types';
import { checkSelectorExists } from './utils';

export class DataTestIdRecoveryStrategy implements HealingStrategyInterface {
  readonly name = 'data-testid-recovery' as const;

  private readonly TEST_ID_ATTRIBUTES = [
    'data-testid',
    'data-test-id',
    'data-cy',
    'data-test',
    'testid',
  ];

  async heal(
    page: Page,
    brokenSelector: string,
    options: HealingStrategyOptions = {}
  ): Promise<HealingResult> {
    try {
      // Extract test ID from broken selector
      const extractedTestId = this.extractTestId(brokenSelector);
      
      if (!extractedTestId) {
        return {
          success: false,
          selector: brokenSelector,
          confidence: 0,
          strategy: this.name,
          alternatives: [],
          error: 'No test ID pattern found in selector',
        };
      }

      // Get all elements with test ID attributes from the page
      const elements = await this.getAllTestIdElements(page);

      // Find matching candidates
      const candidates = this.findCandidates(
        extractedTestId,
        elements,
        options.expectedType
      );

      // Test each candidate
      for (const candidate of candidates) {
        const exists = await checkSelectorExists(page, candidate.selector);
        if (exists) {
          return {
            success: true,
            selector: candidate.selector,
            confidence: candidate.confidence,
            strategy: this.name,
            alternatives: candidates
              .filter((c) => c.selector !== candidate.selector)
              .map((c) => c.selector),
            metadata: {
              originalTestId: extractedTestId,
              foundTestId: candidate.testId,
              matchType: candidate.matchType,
            },
          };
        }
      }

      return {
        success: false,
        selector: brokenSelector,
        confidence: 0,
        strategy: this.name,
        alternatives: candidates.map((c) => c.selector),
        error: 'No matching test ID elements found on page',
      };
    } catch (error: any) {
      return {
        success: false,
        selector: brokenSelector,
        confidence: 0,
        strategy: this.name,
        alternatives: [],
        error: error.message,
      };
    }
  }

  canHandle(selector: string): boolean {
    return this.TEST_ID_ATTRIBUTES.some(
      (attr) =>
        selector.includes(attr) ||
        selector.match(new RegExp(`\\[${attr}[=~]`, 'i')) !== null
    );
  }

  /**
   * Extract test ID value from selector
   */
  private extractTestId(selector: string): string | null {
    for (const attr of this.TEST_ID_ATTRIBUTES) {
      const patterns = [
        new RegExp(`\\[${attr}[=~]["']([^"']+)["']\\]`, 'i'),
        new RegExp(`${attr}[=~]["']([^"']+)["']`, 'i'),
      ];

      for (const pattern of patterns) {
        const match = selector.match(pattern);
        if (match) {
          return match[1];
        }
      }
    }
    return null;
  }

  /**
   * Get all elements with test ID attributes from the page
   */
  private async getAllTestIdElements(page: Page): Promise<ElementInfo[]> {
    return await page.evaluate((testIdAttrs) => {
      const elements: ElementInfo[] = [];
      const allElements = document.querySelectorAll('*');

      for (const el of Array.from(allElements)) {
        const element = el as HTMLElement;
        
        // Check for any test ID attribute
        for (const attr of testIdAttrs) {
          const testId = element.getAttribute(attr);
          if (testId) {
            elements.push({
              tag: element.tagName.toLowerCase(),
              id: element.id || undefined,
              classes: Array.from(element.classList),
              text: element.textContent?.trim().substring(0, 50),
              testId: testId,
              role: element.getAttribute('role') || undefined,
              ariaLabel: element.getAttribute('aria-label') || undefined,
              type: element.getAttribute('type') || undefined,
              name: element.getAttribute('name') || undefined,
            });
            break; // Only record once per element
          }
        }
      }

      return elements;
    }, this.TEST_ID_ATTRIBUTES);
  }

  /**
   * Find candidate selectors based on test ID similarity
   */
  private findCandidates(
    originalTestId: string,
    elements: ElementInfo[],
    expectedType?: string
  ): Array<{ selector: string; testId: string; confidence: number; matchType: string }> {
    const candidates: Array<{
      selector: string;
      testId: string;
      confidence: number;
      matchType: string;
    }> = [];

    for (const element of elements) {
      if (!element.testId) continue;

      // Calculate similarity
      const similarity = this.calculateSimilarity(originalTestId, element.testId);
      
      if (similarity > 0.5) {
        let confidence = similarity;
        let matchType = 'partial';

        // Exact match (case-insensitive)
        if (originalTestId.toLowerCase() === element.testId.toLowerCase()) {
          confidence = 0.95;
          matchType = 'exact';
        }
        // Different separators (kebab-case vs snake_case vs camelCase)
        else if (this.normalizeName(originalTestId) === this.normalizeName(element.testId)) {
          confidence = 0.9;
          matchType = 'normalized';
        }
        // Contains original as substring
        else if (element.testId.toLowerCase().includes(originalTestId.toLowerCase())) {
          confidence = 0.8;
          matchType = 'contains';
        }
        // Original contains current
        else if (originalTestId.toLowerCase().includes(element.testId.toLowerCase())) {
          confidence = 0.75;
          matchType = 'contained-by';
        }

        // Boost confidence if element type matches expected type
        if (expectedType && element.tag === expectedType.toLowerCase()) {
          confidence = Math.min(confidence + 0.1, 1.0);
        }

        // Generate selector for all test ID attribute variants
        for (const attr of this.TEST_ID_ATTRIBUTES) {
          candidates.push({
            selector: `[${attr}="${element.testId}"]`,
            testId: element.testId,
            confidence,
            matchType,
          });
        }
      }
    }

    // Sort by confidence (highest first)
    return candidates.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    if (s1 === s2) return 1.0;

    const len1 = s1.length;
    const len2 = s2.length;

    if (len1 === 0) return 0;
    if (len2 === 0) return 0;

    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= len2; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j;
    }

    // Calculate Levenshtein distance
    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    const distance = matrix[len2][len1];
    const maxLen = Math.max(len1, len2);
    return 1 - distance / maxLen;
  }

  /**
   * Normalize name by removing separators and converting to lowercase
   */
  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[-_\s]/g, '')
      .replace(/([a-z])([A-Z])/g, '$1$2')
      .toLowerCase();
  }
}
