/**
 * Text Content Matching Strategy
 * 
 * Finds elements by their visible text content using fuzzy matching.
 * Considers element type, role, and text similarity (>80% by default).
 */

import { Page } from '@playwright/test';
import {
  HealingResult,
  HealingStrategyInterface,
  HealingStrategyOptions,
  ElementInfo,
} from '../types';
import { checkSelectorExists } from './utils';

export class TextContentMatchingStrategy implements HealingStrategyInterface {
  readonly name = 'text-content-matching' as const;

  private readonly SIMILARITY_THRESHOLD = 0.8;
  private readonly MAX_ELEMENTS = 500;

  async heal(
    page: Page,
    brokenSelector: string,
    options: HealingStrategyOptions = {}
  ): Promise<HealingResult> {
    try {
      // Extract text content from the broken selector
      const extractedText = this.extractTextContent(brokenSelector);

      if (!extractedText) {
        return {
          success: false,
          selector: brokenSelector,
          confidence: 0,
          strategy: this.name,
          alternatives: [],
          error: 'No text pattern found in selector',
        };
      }

      // Get all text-containing elements from the page
      const elements = await this.getAllTextElements(
        page,
        options.maxElements || this.MAX_ELEMENTS
      );

      // Find matching candidates
      const candidates = this.findCandidates(
        extractedText,
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
              originalText: extractedText,
              foundText: candidate.text,
              similarity: candidate.confidence,
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
        error: 'No matching text elements found on page',
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
    const textPatterns = [
      /text[=~*]["']/i,
      /:has-text\(/i,
      /contains\(/i,
      /getByText\(/i,
      /innerText/i,
      /textContent/i,
    ];
    return textPatterns.some((pattern) => pattern.test(selector));
  }

  /**
   * Extract text content from various selector formats
   */
  private extractTextContent(selector: string): string | null {
    const patterns = [
      // Playwright text selectors
      /text[=~*]["']([^"']+)["']/i,
      /:has-text\(["']([^"']+)["']\)/i,
      /getByText\(["']([^"']+)["']\)/i,
      // XPath contains
      /contains\([^,]+,\s*["']([^"']+)["']\)/i,
      // Direct text properties
      /(?:innerText|textContent)[=~]["']([^"']+)["']/i,
    ];

    for (const pattern of patterns) {
      const match = selector.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Get all text-containing elements from the page
   */
  private async getAllTextElements(
    page: Page,
    maxElements: number
  ): Promise<ElementInfo[]> {
    return await page.evaluate((max) => {
      const elements: ElementInfo[] = [];
      const allElements = document.querySelectorAll('*');

      for (const el of Array.from(allElements)) {
        if (elements.length >= max) break;

        const element = el as HTMLElement;
        const text = element.textContent?.trim();

        // Only include elements with actual text content
        // Exclude script, style, and other non-visible elements
        if (
          text &&
          text.length > 0 &&
          text.length < 1000 && // Avoid huge text blocks
          !['SCRIPT', 'STYLE', 'NOSCRIPT', 'HEAD'].includes(element.tagName)
        ) {
          // Check if element is visible
          const style = window.getComputedStyle(element);
          if (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0'
          ) {
            const parent = element.parentElement;
            elements.push({
              tag: element.tagName.toLowerCase(),
              id: element.id || undefined,
              classes: Array.from(element.classList),
              text: text.substring(0, 200),
              testId:
                element.getAttribute('data-testid') ||
                element.getAttribute('data-test-id') ||
                undefined,
              role: element.getAttribute('role') || undefined,
              ariaLabel: element.getAttribute('aria-label') || undefined,
              type: element.getAttribute('type') || undefined,
              name: element.getAttribute('name') || undefined,
              parent: parent
                ? {
                    tag: parent.tagName.toLowerCase(),
                    classes: Array.from(parent.classList),
                  }
                : undefined,
            });
          }
        }
      }

      return elements;
    }, maxElements);
  }

  /**
   * Find candidate selectors based on text similarity
   */
  private findCandidates(
    originalText: string,
    elements: ElementInfo[],
    expectedType?: string
  ): Array<{ selector: string; text: string; confidence: number }> {
    const candidates: Array<{
      selector: string;
      text: string;
      confidence: number;
    }> = [];

    for (const element of elements) {
      if (!element.text) continue;

      // Calculate text similarity
      const similarity = this.calculateTextSimilarity(originalText, element.text);

      if (similarity >= this.SIMILARITY_THRESHOLD) {
        let confidence = similarity;

        // Boost confidence for exact matches
        if (element.text.toLowerCase() === originalText.toLowerCase()) {
          confidence = 0.95;
        }
        // Boost for trimmed exact matches
        else if (
          element.text.trim().toLowerCase() === originalText.trim().toLowerCase()
        ) {
          confidence = 0.92;
        }
        // Boost if element type matches
        if (expectedType && element.tag === expectedType.toLowerCase()) {
          confidence = Math.min(confidence + 0.05, 1.0);
        }

        // Generate multiple selector variants
        const selectors = this.generateTextSelectors(element, originalText);
        
        for (const selector of selectors) {
          candidates.push({
            selector,
            text: element.text,
            confidence,
          });
        }
      }
    }

    // Sort by confidence (highest first)
    return candidates
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10); // Limit to top 10 candidates
  }

  /**
   * Generate various text-based selectors for an element
   */
  private generateTextSelectors(element: ElementInfo, originalText: string): string[] {
    const selectors: string[] = [];
    const escapedText = this.escapeSelector(element.text || '');
    const escapedOriginal = this.escapeSelector(originalText);

    // Exact text match
    selectors.push(`text="${escapedText}"`);

    // Partial text match
    if (escapedText !== escapedOriginal) {
      selectors.push(`text="${escapedOriginal}"`);
    }

    // Has-text selector
    selectors.push(`:has-text("${escapedText}")`);

    // Element-specific text selectors
    if (element.tag === 'button') {
      selectors.push(`button:has-text("${escapedText}")`);
      selectors.push(`button >> text="${escapedText}"`);
    } else if (element.tag === 'a') {
      selectors.push(`a:has-text("${escapedText}")`);
    } else if (element.tag === 'input' || element.tag === 'textarea') {
      if (element.ariaLabel) {
        selectors.push(`[aria-label="${this.escapeSelector(element.ariaLabel)}"]`);
      }
    }

    // Role + text combination
    if (element.role) {
      selectors.push(`[role="${element.role}"]:has-text("${escapedText}")`);
    }

    // Title attribute
    selectors.push(`[title="${escapedText}"]`);

    // Aria-label
    selectors.push(`[aria-label="${escapedText}"]`);

    // Wildcard text match for longer text
    if (escapedText.length > 20) {
      const shortText = escapedText.substring(0, 15);
      selectors.push(`text*="${shortText}"`);
    }

    return selectors;
  }

  /**
   * Calculate text similarity using multiple algorithms
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const s1 = text1.toLowerCase().trim();
    const s2 = text2.toLowerCase().trim();

    if (s1 === s2) return 1.0;

    // Use the shorter text as the pattern
    const [shorter, longer] = s1.length < s2.length ? [s1, s2] : [s2, s1];

    // Check if one contains the other
    if (longer.includes(shorter)) {
      return 0.85 + (shorter.length / longer.length) * 0.15;
    }

    // Levenshtein distance for similar lengths
    if (Math.abs(s1.length - s2.length) < 10) {
      return this.levenshteinSimilarity(s1, s2);
    }

    // Word overlap for longer texts
    return this.wordOverlapSimilarity(s1, s2);
  }

  /**
   * Levenshtein distance-based similarity
   */
  private levenshteinSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0 || len2 === 0) return 0;

    const matrix: number[][] = Array(len2 + 1)
      .fill(null)
      .map(() => Array(len1 + 1).fill(0));

    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;

    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + cost
        );
      }
    }

    const distance = matrix[len2][len1];
    const maxLen = Math.max(len1, len2);
    return 1 - distance / maxLen;
  }

  /**
   * Word overlap-based similarity for longer texts
   */
  private wordOverlapSimilarity(text1: string, text2: string): number {
    const words1 = text1.split(/\s+/).filter((w) => w.length > 2);
    const words2 = text2.split(/\s+/).filter((w) => w.length > 2);

    if (words1.length === 0 || words2.length === 0) return 0;

    const set1 = new Set(words1);
    const set2 = new Set(words2);

    let overlap = 0;
    for (const word of set1) {
      if (set2.has(word)) overlap++;
    }

    const maxWords = Math.max(words1.length, words2.length);
    return overlap / maxWords;
  }

  /**
   * Escape special characters in selector
   */
  private escapeSelector(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, ' ')
      .replace(/\r/g, ' ')
      .replace(/\t/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
