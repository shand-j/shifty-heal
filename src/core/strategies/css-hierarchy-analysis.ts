/**
 * CSS Hierarchy Analysis Strategy
 * 
 * Analyzes the DOM structure around where the element should be.
 * Looks for elements with similar hierarchy, CSS classes, and HTML structure.
 */

import { Page } from '@playwright/test';
import {
  HealingResult,
  HealingStrategyInterface,
  HealingStrategyOptions,
} from '../types';
import { checkSelectorExists } from './utils';

export class CssHierarchyAnalysisStrategy implements HealingStrategyInterface {
  readonly name = 'css-hierarchy-analysis' as const;

  async heal(
    page: Page,
    brokenSelector: string
  ): Promise<HealingResult> {
    try {
      // Parse the broken selector
      const analysis = this.analyzeSelector(brokenSelector);

      // Generate alternative selectors
      const candidates = this.generateAlternatives(analysis);

      // Test each candidate
      const validCandidates: Array<{
        selector: string;
        confidence: number;
        reason: string;
      }> = [];

      for (const candidate of candidates) {
        const exists = await checkSelectorExists(page, candidate.selector);
        if (exists) {
          validCandidates.push(candidate);
          
          // Return first valid candidate (highest confidence)
          if (validCandidates.length === 1) {
            return {
              success: true,
              selector: candidate.selector,
              confidence: candidate.confidence,
              strategy: this.name,
              alternatives: candidates
                .filter((c) => c.selector !== candidate.selector)
                .map((c) => c.selector),
              metadata: {
                originalSelector: brokenSelector,
                transformationType: candidate.reason,
              },
            };
          }
        }
      }

      // If we found multiple valid candidates, return the best one
      if (validCandidates.length > 0) {
        const best = validCandidates[0];
        return {
          success: true,
          selector: best.selector,
          confidence: best.confidence,
          strategy: this.name,
          alternatives: validCandidates
            .slice(1)
            .map((c) => c.selector)
            .concat(candidates.filter((c) => !validCandidates.includes(c)).map((c) => c.selector)),
          metadata: {
            originalSelector: brokenSelector,
            transformationType: best.reason,
          },
        };
      }

      return {
        success: false,
        selector: brokenSelector,
        confidence: 0,
        strategy: this.name,
        alternatives: candidates.map((c) => c.selector),
        error: 'No CSS hierarchy alternatives found',
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
    // This strategy can handle any CSS selector
    return selector.includes('.') || selector.includes('#') || selector.includes(' ');
  }

  /**
   * Analyze a selector to understand its structure
   */
  private analyzeSelector(selector: string): {
    hasId: boolean;
    ids: string[];
    hasClass: boolean;
    classes: string[];
    hasElement: boolean;
    elements: string[];
    hasAttribute: boolean;
    attributes: string[];
    hasNthChild: boolean;
    nthChildren: string[];
    parts: string[];
    depth: number;
  } {
    const analysis = {
      hasId: selector.includes('#'),
      ids: [] as string[],
      hasClass: selector.includes('.'),
      classes: [] as string[],
      hasElement: /^[a-z]/i.test(selector),
      elements: [] as string[],
      hasAttribute: selector.includes('['),
      attributes: [] as string[],
      hasNthChild: selector.includes(':nth-child'),
      nthChildren: [] as string[],
      parts: selector.split(/\s+/),
      depth: selector.split(/\s+/).length,
    };

    // Extract IDs
    const idMatches = selector.match(/#([a-zA-Z0-9_-]+)/g);
    if (idMatches) {
      analysis.ids = idMatches.map((id) => id.substring(1));
    }

    // Extract classes
    const classMatches = selector.match(/\.([a-zA-Z0-9_-]+)/g);
    if (classMatches) {
      analysis.classes = classMatches.map((cls) => cls.substring(1));
    }

    // Extract elements
    const elementMatches = selector.match(/^([a-z]+)|(?:\s)([a-z]+)/gi);
    if (elementMatches) {
      analysis.elements = elementMatches.map((el) => el.trim().toLowerCase());
    }

    // Extract attributes
    const attrMatches = selector.match(/\[([^\]]+)\]/g);
    if (attrMatches) {
      analysis.attributes = attrMatches;
    }

    // Extract nth-child selectors
    const nthMatches = selector.match(/:nth-child\(\d+\)/g);
    if (nthMatches) {
      analysis.nthChildren = nthMatches;
    }

    return analysis;
  }

  /**
   * Generate alternative selectors based on hierarchy analysis
   */
  private generateAlternatives(analysis: {
    hasId: boolean;
    ids: string[];
    hasClass: boolean;
    classes: string[];
    hasElement: boolean;
    elements: string[];
    hasAttribute: boolean;
    attributes: string[];
    hasNthChild: boolean;
    nthChildren: string[];
    parts: string[];
    depth: number;
  }): Array<{ selector: string; confidence: number; reason: string }> {
    const alternatives: Array<{
      selector: string;
      confidence: number;
      reason: string;
    }> = [];

    // Strategy 1: Remove specific IDs (IDs often change)
    if (analysis.hasId && analysis.parts.length > 1) {
      const withoutIds = analysis.parts
        .map((part) => part.replace(/#[a-zA-Z0-9_-]+/g, '').trim())
        .filter((part) => part.length > 0)
        .join(' ');
      
      if (withoutIds) {
        alternatives.push({
          selector: withoutIds,
          confidence: 0.7,
          reason: 'removed-ids',
        });
      }
    }

    // Strategy 2: Remove nth-child selectors (position-dependent)
    if (analysis.hasNthChild) {
      const withoutNth = analysis.parts
        .map((part) => part.replace(/:nth-child\(\d+\)/g, ''))
        .filter((part) => part.length > 0)
        .join(' ');
      
      if (withoutNth) {
        alternatives.push({
          selector: withoutNth,
          confidence: 0.75,
          reason: 'removed-nth-child',
        });
      }
    }

    // Strategy 3: Simplify to last 2 parts (reduce specificity)
    if (analysis.depth > 2) {
      const simplified = analysis.parts.slice(-2).join(' ');
      alternatives.push({
        selector: simplified,
        confidence: 0.65,
        reason: 'simplified-hierarchy',
      });
    }

    // Strategy 4: Use only classes (if available)
    if (analysis.hasClass && analysis.classes.length > 0) {
      const classOnly = analysis.classes.map((cls) => `.${cls}`).join('');
      alternatives.push({
        selector: classOnly,
        confidence: 0.6,
        reason: 'class-only',
      });

      // Also try each class individually
      for (const cls of analysis.classes) {
        alternatives.push({
          selector: `.${cls}`,
          confidence: 0.55,
          reason: 'single-class',
        });
      }
    }

    // Strategy 5: Use element type with classes (if available)
    if (analysis.hasElement && analysis.hasClass && analysis.elements.length > 0) {
      const element = analysis.elements[analysis.elements.length - 1];
      const classOnly = analysis.classes.map((cls) => `.${cls}`).join('');
      alternatives.push({
        selector: `${element}${classOnly}`,
        confidence: 0.68,
        reason: 'element-with-classes',
      });
    }

    // Strategy 6: Direct child instead of descendant
    if (analysis.parts.length > 1) {
      const directChild = analysis.parts.join(' > ');
      alternatives.push({
        selector: directChild,
        confidence: 0.58,
        reason: 'direct-child',
      });
    }

    // Strategy 7: Use attributes only
    if (analysis.hasAttribute && analysis.attributes.length > 0) {
      for (const attr of analysis.attributes) {
        alternatives.push({
          selector: attr,
          confidence: 0.72,
          reason: 'attribute-only',
        });
      }
    }

    // Strategy 8: First element with first class
    if (analysis.elements.length > 0 && analysis.classes.length > 0) {
      const element = analysis.elements[0];
      const cls = analysis.classes[0];
      alternatives.push({
        selector: `${element}.${cls}`,
        confidence: 0.62,
        reason: 'first-element-first-class',
      });
    }

    // Strategy 9: Last element only
    if (analysis.elements.length > 0) {
      const lastElement = analysis.elements[analysis.elements.length - 1];
      alternatives.push({
        selector: lastElement,
        confidence: 0.5,
        reason: 'last-element-only',
      });
    }

    // Strategy 10: Remove last part (parent element)
    if (analysis.parts.length > 1) {
      const parentSelector = analysis.parts.slice(0, -1).join(' ');
      alternatives.push({
        selector: parentSelector,
        confidence: 0.45,
        reason: 'parent-element',
      });
    }

    // Sort by confidence (highest first) and remove duplicates
    const seen = new Set<string>();
    return alternatives
      .filter((alt) => {
        if (seen.has(alt.selector)) return false;
        seen.add(alt.selector);
        return true;
      })
      .sort((a, b) => b.confidence - a.confidence);
  }
}
