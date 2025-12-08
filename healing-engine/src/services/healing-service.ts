import { Ollama } from 'ollama';

export interface HealingRequest {
  testFile: string;
  testTitle: string;
  errorMessage: string;
  errorStack?: string;
  failedSelector: string | null;
  failureType: string;
  testCode: string;
  healingStrategies: string[];
  ollamaEndpoint: string;
  llmModel: string;
  minConfidence: number;
}

export interface HealingResult {
  healedCode: string;
  confidence: number;
  strategy: string;
  explanation: string;
  changes: Array<{
    type: string;
    before: string;
    after: string;
    reason: string;
  }>;
}

export class HealingService {
  private strategies: Map<string, HealingStrategy>;

  constructor() {
    this.strategies = new Map();
    this.strategies.set('selector-healing', new SelectorHealingStrategy());
    this.strategies.set('timeout-healing', new TimeoutHealingStrategy());
    this.strategies.set('wait-strategy', new WaitStrategyOptimizer());
    this.strategies.set('async-healing', new AsyncHealingStrategy());
  }

  async heal(request: HealingRequest): Promise<HealingResult> {
    // Determine which strategy to use based on failure type
    const strategy = this.selectStrategy(request.failureType, request.healingStrategies);
    
    if (!strategy) {
      throw new Error(`No healing strategy found for failure type: ${request.failureType}`);
    }

    // Try heuristic healing first (fast, deterministic)
    const heuristicResult = await strategy.healHeuristic(request);
    
    if (heuristicResult && heuristicResult.confidence >= request.minConfidence) {
      return heuristicResult;
    }

    // Fall back to LLM-based healing (slower, more intelligent)
    const llmResult = await strategy.healWithLLM(request);
    
    return llmResult;
  }

  private selectStrategy(failureType: string, requestedStrategies: string[]): HealingStrategy | null {
    // Map failure types to strategies
    const strategyMap: Record<string, string> = {
      'timeout': 'timeout-healing',
      'selector': 'selector-healing',
      'detached-element': 'selector-healing',
      'race-condition': 'wait-strategy',
      'network': 'timeout-healing',
      'unknown': 'wait-strategy'
    };

    const strategyName = strategyMap[failureType];
    
    if (strategyName && requestedStrategies.includes(strategyName)) {
      return this.strategies.get(strategyName) || null;
    }

    // Default to first requested strategy
    return this.strategies.get(requestedStrategies[0]) || null;
  }
}

abstract class HealingStrategy {
  abstract healHeuristic(request: HealingRequest): Promise<HealingResult | null>;
  abstract healWithLLM(request: HealingRequest): Promise<HealingResult>;

  protected async callLLM(request: HealingRequest, prompt: string): Promise<string> {
    const ollama = new Ollama({ host: request.ollamaEndpoint });

    const response = await ollama.generate({
      model: request.llmModel,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.2,
        num_predict: 2048
      }
    });

    return response.response;
  }

  protected calculateConfidence(changes: Array<{ type: string; before: string; after: string }>): number {
    // Simple confidence calculation based on change types
    let confidence = 0.5;

    for (const change of changes) {
      if (change.type === 'timeout-increase') {
        confidence += 0.15; // High confidence for timeout increases
      } else if (change.type === 'wait-for-selector') {
        confidence += 0.2; // Very high confidence for proper waits
      } else if (change.type === 'selector-improvement') {
        confidence += 0.1; // Medium confidence for selector changes
      } else if (change.type === 'async-fix') {
        confidence += 0.15; // High confidence for missing await
      }
    }

    return Math.min(confidence, 1.0);
  }
}

class TimeoutHealingStrategy extends HealingStrategy {
  async healHeuristic(request: HealingRequest): Promise<HealingResult | null> {
    const changes: Array<{ type: string; before: string; after: string; reason: string }> = [];
    let healedCode = request.testCode;

    // Pattern 1: Increase explicit timeout values
    const timeoutPattern = /timeout:\s*(\d+)/g;
    let match;
    
    while ((match = timeoutPattern.exec(request.testCode)) !== null) {
      const currentTimeout = parseInt(match[1]);
      if (currentTimeout < 10000) {
        const newTimeout = Math.min(currentTimeout * 3, 15000);
        const before = `timeout: ${currentTimeout}`;
        const after = `timeout: ${newTimeout}`;
        healedCode = healedCode.replace(before, after);
        changes.push({
          type: 'timeout-increase',
          before,
          after,
          reason: `Increased timeout from ${currentTimeout}ms to ${newTimeout}ms to prevent flakiness`
        });
      }
    }

    // Pattern 2: Add timeout to assertions without one
    if (/\.toBeVisible\(\)/.test(healedCode) && !/\.toBeVisible\(\{.*timeout/.test(healedCode)) {
      healedCode = healedCode.replace(/\.toBeVisible\(\)/g, '.toBeVisible({ timeout: 15000 })');
      changes.push({
        type: 'timeout-add',
        before: '.toBeVisible()',
        after: '.toBeVisible({ timeout: 15000 })',
        reason: 'Added explicit timeout to prevent failures on slow networks'
      });
    }

    if (changes.length === 0) {
      return null;
    }

    return {
      healedCode,
      confidence: this.calculateConfidence(changes),
      strategy: 'timeout-healing-heuristic',
      explanation: `Applied ${changes.length} timeout adjustments to prevent flaky failures`,
      changes
    };
  }

  async healWithLLM(request: HealingRequest): Promise<HealingResult> {
    const prompt = `You are a Playwright test healing assistant. Fix this test by adjusting timeouts.

ERROR: ${request.errorMessage}

TEST CODE:
\`\`\`typescript
${request.testCode}
\`\`\`

INSTRUCTIONS:
1. Identify timeout issues
2. Increase timeouts to reasonable values (10-15 seconds)
3. Add explicit timeouts where missing
4. Return ONLY the fixed test code, no explanations

FIXED CODE:`;

    const llmResponse = await this.callLLM(request, prompt);
    
    // Extract code from response
    const codeMatch = llmResponse.match(/```(?:typescript|javascript)?\n([\s\S]*?)\n```/);
    const healedCode = codeMatch ? codeMatch[1].trim() : llmResponse.trim();

    return {
      healedCode,
      confidence: 0.7,
      strategy: 'timeout-healing-llm',
      explanation: 'LLM adjusted timeouts based on error analysis',
      changes: [{
        type: 'llm-timeout-fix',
        before: request.testCode.substring(0, 100) + '...',
        after: healedCode.substring(0, 100) + '...',
        reason: 'LLM-generated timeout fixes'
      }]
    };
  }
}

class SelectorHealingStrategy extends HealingStrategy {
  async healHeuristic(request: HealingRequest): Promise<HealingResult | null> {
    if (!request.failedSelector) {
      return null;
    }

    const changes: Array<{ type: string; before: string; after: string; reason: string }> = [];
    let healedCode = request.testCode;

    // Pattern 1: Convert nth-child to more stable selectors
    if (request.failedSelector.includes(':nth-child')) {
      const betterSelector = request.failedSelector.replace(/:nth-child\(\d+\)/g, '[data-testid]');
      healedCode = healedCode.replace(request.failedSelector, betterSelector);
      changes.push({
        type: 'selector-improvement',
        before: request.failedSelector,
        after: betterSelector,
        reason: 'Replaced brittle nth-child with data-testid selector'
      });
    }

    // Pattern 2: Add retries for selector operations
    if (/\.click\(\)/.test(healedCode) && !/retry/.test(healedCode)) {
      healedCode = healedCode.replace(
        /await page\.locator\('([^']+)'\)\.click\(\)/g,
        "await page.locator('$1').click({ trial: true });\n  await page.locator('$1').click()"
      );
      changes.push({
        type: 'selector-stability',
        before: "await page.locator('...').click()",
        after: "await page.locator('...').click({ trial: true });\n  await page.locator('...').click()",
        reason: 'Added trial click to ensure element is ready'
      });
    }

    if (changes.length === 0) {
      return null;
    }

    return {
      healedCode,
      confidence: this.calculateConfidence(changes),
      strategy: 'selector-healing-heuristic',
      explanation: `Improved ${changes.length} selectors for better stability`,
      changes
    };
  }

  async healWithLLM(request: HealingRequest): Promise<HealingResult> {
    const prompt = `You are a Playwright test healing assistant. Fix this selector issue.

ERROR: ${request.errorMessage}
FAILED SELECTOR: ${request.failedSelector}

TEST CODE:
\`\`\`typescript
${request.testCode}
\`\`\`

INSTRUCTIONS:
1. Replace brittle selectors (nth-child, IDs) with robust ones (data-testid, role, text)
2. Add waitForSelector before operations
3. Use page.getByRole or page.getByText when possible
4. Return ONLY the fixed test code

FIXED CODE:`;

    const llmResponse = await this.callLLM(request, prompt);
    const codeMatch = llmResponse.match(/```(?:typescript|javascript)?\n([\s\S]*?)\n```/);
    const healedCode = codeMatch ? codeMatch[1].trim() : llmResponse.trim();

    return {
      healedCode,
      confidence: 0.75,
      strategy: 'selector-healing-llm',
      explanation: 'LLM improved selectors for better stability',
      changes: [{
        type: 'llm-selector-fix',
        before: request.failedSelector || 'unknown',
        after: 'LLM-generated selector',
        reason: 'LLM replaced brittle selector with robust alternative'
      }]
    };
  }
}

class WaitStrategyOptimizer extends HealingStrategy {
  async healHeuristic(request: HealingRequest): Promise<HealingResult | null> {
    const changes: Array<{ type: string; before: string; after: string; reason: string }> = [];
    let healedCode = request.testCode;

    // Pattern 1: Replace waitForTimeout with proper waits
    const waitForTimeoutPattern = /await page\.waitForTimeout\((\d+)\)/g;
    let match;
    
    while ((match = waitForTimeoutPattern.exec(request.testCode)) !== null) {
      const timeout = match[1];
      healedCode = healedCode.replace(
        match[0],
        `await page.waitForLoadState('networkidle')`
      );
      changes.push({
        type: 'wait-for-selector',
        before: `await page.waitForTimeout(${timeout})`,
        after: `await page.waitForLoadState('networkidle')`,
        reason: 'Replaced hardcoded wait with network idle detection'
      });
    }

    // Pattern 2: Add wait before click operations
    if (/\.click\(\)/.test(healedCode)) {
      healedCode = healedCode.replace(
        /await page\.locator\('([^']+)'\)\.click\(\)/g,
        "await page.locator('$1').waitFor({ state: 'visible' });\n  await page.locator('$1').click()"
      );
      changes.push({
        type: 'wait-before-action',
        before: "await page.locator('...').click()",
        after: "await page.locator('...').waitFor({ state: 'visible' });\n  await page.locator('...').click()",
        reason: 'Added explicit wait for element visibility before click'
      });
    }

    if (changes.length === 0) {
      return null;
    }

    return {
      healedCode,
      confidence: this.calculateConfidence(changes),
      strategy: 'wait-strategy-heuristic',
      explanation: `Optimized ${changes.length} wait strategies`,
      changes
    };
  }

  async healWithLLM(request: HealingRequest): Promise<HealingResult> {
    const prompt = `You are a Playwright test healing assistant. Fix wait/timing issues.

ERROR: ${request.errorMessage}

TEST CODE:
\`\`\`typescript
${request.testCode}
\`\`\`

INSTRUCTIONS:
1. Replace page.waitForTimeout() with proper waitForSelector()
2. Add waitFor({ state: 'visible' }) before interactions
3. Use page.waitForLoadState('networkidle') for navigation
4. Return ONLY the fixed test code

FIXED CODE:`;

    const llmResponse = await this.callLLM(request, prompt);
    const codeMatch = llmResponse.match(/```(?:typescript|javascript)?\n([\s\S]*?)\n```/);
    const healedCode = codeMatch ? codeMatch[1].trim() : llmResponse.trim();

    return {
      healedCode,
      confidence: 0.8,
      strategy: 'wait-strategy-llm',
      explanation: 'LLM replaced hardcoded waits with proper synchronization',
      changes: [{
        type: 'llm-wait-fix',
        before: 'waitForTimeout',
        after: 'proper wait strategies',
        reason: 'LLM optimized wait strategies'
      }]
    };
  }
}

class AsyncHealingStrategy extends HealingStrategy {
  async healHeuristic(request: HealingRequest): Promise<HealingResult | null> {
    const changes: Array<{ type: string; before: string; after: string; reason: string }> = [];
    let healedCode = request.testCode;

    // Pattern 1: Add missing await keywords
    const asyncCallPattern = /(?<!await\s+)(page\.\w+\([^)]*\)(?:\.\w+\([^)]*\))*)/g;
    const matches = [...request.testCode.matchAll(asyncCallPattern)];
    
    for (const match of matches) {
      const call = match[1];
      if (/page\.(goto|click|fill|type|waitFor|locator)/.test(call)) {
        healedCode = healedCode.replace(call, `await ${call}`);
        changes.push({
          type: 'async-fix',
          before: call,
          after: `await ${call}`,
          reason: 'Added missing await keyword'
        });
      }
    }

    // Pattern 2: Convert Promise.all to sequential awaits for cart operations
    if (/Promise\.all/.test(healedCode)) {
      const promiseAllMatch = /Promise\.all\(\[([\s\S]*?)\]\)/.exec(healedCode);
      if (promiseAllMatch) {
        const promises = promiseAllMatch[1].split(',').map(p => p.trim());
        const sequential = promises.map(p => `await ${p.replace(/^\s*await\s+/, '')}`).join(';\n  ');
        healedCode = healedCode.replace(promiseAllMatch[0], sequential);
        changes.push({
          type: 'sequential-execution',
          before: 'Promise.all([...])',
          after: 'Sequential await calls',
          reason: 'Converted concurrent operations to sequential to prevent race conditions'
        });
      }
    }

    if (changes.length === 0) {
      return null;
    }

    return {
      healedCode,
      confidence: this.calculateConfidence(changes),
      strategy: 'async-healing-heuristic',
      explanation: `Fixed ${changes.length} async/await issues`,
      changes
    };
  }

  async healWithLLM(request: HealingRequest): Promise<HealingResult> {
    const prompt = `You are a Playwright test healing assistant. Fix async/await issues.

ERROR: ${request.errorMessage}

TEST CODE:
\`\`\`typescript
${request.testCode}
\`\`\`

INSTRUCTIONS:
1. Add missing 'await' keywords before async operations
2. Convert Promise.all to sequential operations where order matters
3. Ensure all page operations are properly awaited
4. Return ONLY the fixed test code

FIXED CODE:`;

    const llmResponse = await this.callLLM(request, prompt);
    const codeMatch = llmResponse.match(/```(?:typescript|javascript)?\n([\s\S]*?)\n```/);
    const healedCode = codeMatch ? codeMatch[1].trim() : llmResponse.trim();

    return {
      healedCode,
      confidence: 0.75,
      strategy: 'async-healing-llm',
      explanation: 'LLM fixed async/await issues',
      changes: [{
        type: 'llm-async-fix',
        before: 'Missing await',
        after: 'Properly awaited operations',
        reason: 'LLM added missing await keywords'
      }]
    };
  }
}
