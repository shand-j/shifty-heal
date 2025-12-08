/**
 * AI-Powered Analysis Strategy
 *
 * Uses Ollama LLM to analyze page structure and suggest alternative selectors.
 * Takes screenshots and DOM structure for context.
 */

import { Page } from "@playwright/test";
import {
  HealingResult,
  HealingStrategyInterface,
  HealingStrategyOptions,
} from "../types";
import { checkSelectorExists, validateUrl } from "./utils";

export class AiPoweredAnalysisStrategy implements HealingStrategyInterface {
  readonly name = "ai-powered-analysis" as const;

  private ollamaUrl: string;
  private model: string;
  private timeout: number;

  constructor(
    options: {
      ollamaUrl?: string;
      model?: string;
      timeout?: number;
    } = {}
  ) {
    this.ollamaUrl = options.ollamaUrl || "http://localhost:11434";

    // Validate Ollama URL to prevent SSRF attacks
    if (!validateUrl(this.ollamaUrl)) {
      throw new Error(
        "Invalid Ollama URL. Only localhost and 127.0.0.1 are allowed for security."
      );
    }

    this.model = options.model || "qwen2.5-coder:3b";
    this.timeout = options.timeout || 30000;
  }

  async heal(
    page: Page,
    brokenSelector: string,
    options: HealingStrategyOptions = {}
  ): Promise<HealingResult> {
    try {
      // Check if Ollama is available
      const isAvailable = await this.checkOllamaAvailability();
      if (!isAvailable) {
        return {
          success: false,
          selector: brokenSelector,
          confidence: 0,
          strategy: this.name,
          alternatives: [],
          error: "Ollama is not available. Please ensure Ollama is running.",
        };
      }

      // Get page context
      const pageContext = await this.extractPageContext(
        page,
        options.maxElements || 50
      );

      // Build prompt for AI
      const prompt = this.buildPrompt(
        brokenSelector,
        pageContext,
        options.expectedType
      );

      // Call Ollama API
      const aiResponse = await this.callOllama(prompt);

      // Parse AI suggestions
      const suggestions = this.parseAiSuggestions(aiResponse);

      if (suggestions.length === 0) {
        return {
          success: false,
          selector: brokenSelector,
          confidence: 0,
          strategy: this.name,
          alternatives: [],
          error: "AI did not suggest any alternatives",
          metadata: {
            aiResponse,
          },
        };
      }

      // Test each suggestion
      for (const suggestion of suggestions) {
        const exists = await checkSelectorExists(page, suggestion.selector);
        if (exists) {
          return {
            success: true,
            selector: suggestion.selector,
            confidence: suggestion.confidence,
            strategy: this.name,
            alternatives: suggestions
              .filter((s) => s.selector !== suggestion.selector)
              .map((s) => s.selector),
            metadata: {
              aiReasoning: suggestion.reasoning,
              totalSuggestions: suggestions.length,
            },
          };
        }
      }

      return {
        success: false,
        selector: brokenSelector,
        confidence: 0,
        strategy: this.name,
        alternatives: suggestions.map((s) => s.selector),
        error: "None of the AI suggestions matched elements on the page",
        metadata: {
          aiResponse,
          suggestions: suggestions.length,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        selector: brokenSelector,
        confidence: 0,
        strategy: this.name,
        alternatives: [],
        error: `AI analysis failed: ${error.message}`,
      };
    }
  }

  canHandle(): boolean {
    // AI can potentially handle any selector
    return true;
  }

  /**
   * Check if Ollama is available
   */
  private async checkOllamaAvailability(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.ollamaUrl}/api/tags`, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Extract relevant page context for AI analysis
   */
  private async extractPageContext(
    page: Page,
    maxElements: number
  ): Promise<{
    url: string;
    title: string;
    elements: Array<{
      tag: string;
      id?: string;
      classes: string[];
      text?: string;
      testId?: string;
      role?: string;
      type?: string;
      visible: boolean;
    }>;
  }> {
    const url = page.url();
    const title = await page.title();

    const elements = await page.evaluate((max) => {
      const result: Array<{
        tag: string;
        id?: string;
        classes: string[];
        text?: string;
        testId?: string;
        role?: string;
        type?: string;
        visible: boolean;
      }> = [];

      const allElements = document.querySelectorAll("*");

      for (const el of Array.from(allElements)) {
        if (result.length >= max) break;

        const element = el as HTMLElement;
        const style = window.getComputedStyle(element);
        const isVisible =
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          style.opacity !== "0";

        const text = element.textContent?.trim().substring(0, 100);

        // Prioritize interactive elements
        const isInteractive = [
          "BUTTON",
          "A",
          "INPUT",
          "SELECT",
          "TEXTAREA",
        ].includes(element.tagName);

        if (isInteractive || (isVisible && text && text.length > 0)) {
          result.push({
            tag: element.tagName.toLowerCase(),
            id: element.id || undefined,
            classes: Array.from(element.classList),
            text: text || undefined,
            testId:
              element.getAttribute("data-testid") ||
              element.getAttribute("data-test-id") ||
              undefined,
            role: element.getAttribute("role") || undefined,
            type: element.getAttribute("type") || undefined,
            visible: isVisible,
          });
        }
      }

      return result;
    }, maxElements);

    return { url, title, elements };
  }

  /**
   * Build prompt for Ollama
   */
  private buildPrompt(
    brokenSelector: string,
    pageContext: {
      url: string;
      title: string;
      elements: any[];
    },
    expectedType?: string
  ): string {
    return `You are an expert Playwright test automation engineer specializing in CSS selectors and web element identification.

**Task**: The following Playwright selector is broken and needs to be fixed:
\`\`\`
${brokenSelector}
\`\`\`

${expectedType ? `**Expected Element Type**: ${expectedType}\n` : ""}
**Page Information**:
- URL: ${pageContext.url}
- Title: ${pageContext.title}

**Available Elements on Page** (showing up to ${pageContext.elements.length} interactive/visible elements):
\`\`\`json
${JSON.stringify(pageContext.elements.slice(0, 30), null, 2)}
\`\`\`

**Instructions**:
1. Analyze the broken selector and understand what it was trying to target
2. Look at the available elements on the page
3. Suggest 3-5 alternative Playwright selectors that could work
4. Prioritize selectors in this order:
   - data-testid attributes (most reliable)
   - role-based selectors
   - text-based selectors
   - CSS class selectors (if classes look semantic)
   - ID selectors (only if they look stable)
5. Avoid selectors that look auto-generated or unstable

**Response Format** (respond ONLY with valid JSON, no other text):
\`\`\`json
{
  "suggestions": [
    {
      "selector": "the actual Playwright selector string",
      "confidence": 0.85,
      "reasoning": "brief explanation of why this selector should work"
    }
  ]
}
\`\`\`

Provide your response now:`;
  }

  /**
   * Call Ollama API
   */
  private async callOllama(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature: 0.3, // Lower temperature for more deterministic output
            top_p: 0.9,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `Ollama API error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as { response?: string };
      return data.response || "";
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        throw new Error("Ollama request timed out");
      }
      throw error;
    }
  }

  /**
   * Parse AI suggestions from response
   */
  private parseAiSuggestions(
    response: string
  ): Array<{ selector: string; confidence: number; reasoning?: string }> {
    const suggestions: Array<{
      selector: string;
      confidence: number;
      reasoning?: string;
    }> = [];

    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*"suggestions"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
          for (const item of parsed.suggestions) {
            if (item.selector && typeof item.selector === "string") {
              suggestions.push({
                selector: item.selector.trim(),
                confidence: item.confidence || 0.7,
                reasoning: item.reasoning,
              });
            }
          }
        }
      }

      // Fallback: extract selectors from quoted strings
      if (suggestions.length === 0) {
        const selectorPattern = /"selector"\s*:\s*"([^"]+)"/g;
        let match;
        while ((match = selectorPattern.exec(response)) !== null) {
          suggestions.push({
            selector: match[1].trim(),
            confidence: 0.7,
          });
        }
      }

      // Another fallback: look for selector-like patterns in the response
      if (suggestions.length === 0) {
        const patterns = [
          /\[data-testid=["']([^"']+)["']\]/g,
          /\[role=["']([^"']+)["']\]/g,
          /text=["']([^"']+)["']/g,
          /button:has-text\(["']([^"']+)["']\)/g,
        ];

        for (const pattern of patterns) {
          const matches = response.matchAll(pattern);
          for (const match of matches) {
            suggestions.push({
              selector: match[0],
              confidence: 0.6,
            });
          }
        }
      }
    } catch (error) {
      // If parsing fails, return empty array
    }

    // Sort by confidence and remove duplicates
    const seen = new Set<string>();
    return suggestions
      .filter((s) => {
        if (seen.has(s.selector)) return false;
        seen.add(s.selector);
        return true;
      })
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5); // Limit to top 5
  }
}
