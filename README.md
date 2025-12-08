# @shifty/playwright-healing

> Autonomous selector healing engine for Playwright tests with AI-powered analysis

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![Playwright](https://img.shields.io/badge/playwright-%3E%3D1.40.0-green.svg)](https://playwright.dev)

## 🐍 Looking for Python?

**This package is for Node.js/TypeScript users.** If you're working in Python (especially for AI/ML work), check out the [Python version](../playwright-healing-python/) which is specifically designed for the Python ecosystem.

## 🚀 Features

- **🔧 Automatic Selector Healing**: Automatically fixes broken selectors without manual intervention
- **🤖 AI-Powered Analysis**: Uses Ollama LLM for intelligent selector suggestions
- **📊 Multiple Healing Strategies**:
  - Data-testid recovery (scans for test ID attributes)
  - Text content matching (fuzzy text search with 80%+ similarity)
  - CSS hierarchy analysis (structural DOM analysis)
  - AI-powered analysis (Ollama integration)
- **⚡ Smart Retry Logic**: Handles timeouts and flaky tests automatically
- **💾 Healing Cache**: Caches successful healing to speed up subsequent runs
- **📈 Flakiness Detection**: Tracks and reports selector stability
- **🔌 Zero Dependencies**: Works standalone without external backend
- **⚙️ Flexible Configuration**: Env vars, config files, or programmatic API

## 📦 Installation

```bash
npm install @shifty/playwright-healing
```

Or with yarn:

```bash
yarn add @shifty/playwright-healing
```

## 🎯 Quick Start

### Basic Usage

```typescript
import { healingTest, expect } from "@shifty/playwright-healing";

healingTest("login flow", async ({ healingPage }) => {
  await healingPage.goto("https://example.com/login");

  // These selectors will auto-heal if they break
  await healingPage.fill("#username", "user@test.com");
  await healingPage.fill("#password", "SecurePass123!");
  await healingPage.click('button[type="submit"]');

  // Verify success
  const welcome = await healingPage.locator(".welcome-message");
  await expect(welcome).toBeVisible();
});
```

### Using Healing Page Directly

```typescript
import { test } from "@playwright/test";
import { HealingPage } from "@shifty/playwright-healing";

test("example", async ({ page }) => {
  const healingPage = new HealingPage(page, {
    enabled: true,
    strategies: ["data-testid-recovery", "text-content-matching"],
  });

  await healingPage.goto("https://example.com");
  await healingPage.click("#broken-selector"); // Will auto-heal
});
```

## 🛠️ Configuration

### Environment Variables

```bash
# Enable/disable healing
export HEALING_ENABLED=true

# Healing strategies (comma-separated)
export HEALING_STRATEGIES=data-testid-recovery,text-content-matching,ai-powered-analysis

# Max healing attempts
export HEALING_MAX_ATTEMPTS=3

# Cache healed selectors
export HEALING_CACHE=true

# Ollama configuration
export OLLAMA_URL=http://localhost:11434
export OLLAMA_MODEL=qwen2.5-coder:3b
export OLLAMA_TIMEOUT=30000

# Retry configuration
export RETRY_ON_TIMEOUT=true
export RETRY_ON_FLAKINESS=true
export MAX_RETRIES=2
export INITIAL_BACKOFF=1000

# Telemetry
export TELEMETRY_ENABLED=true
export LOG_LEVEL=info
```

### Configuration File

Create `healing.config.js` in your project root:

```javascript
module.exports = {
  enabled: true,
  strategies: [
    "data-testid-recovery",
    "text-content-matching",
    "css-hierarchy-analysis",
    "ai-powered-analysis",
  ],
  maxAttempts: 3,
  cacheHealing: true,
  ollama: {
    url: "http://localhost:11434",
    model: "qwen2.5-coder:3b",
    timeout: 30000,
  },
  retry: {
    onTimeout: true,
    onFlakiness: true,
    maxRetries: 2,
    initialBackoff: 1000,
  },
  telemetry: {
    enabled: true,
    logLevel: "info",
  },
};
```

### Programmatic Configuration

```typescript
import { configureHealing } from "@shifty/playwright-healing";

export const myHealingTest = configureHealing({
  enabled: true,
  strategies: ["data-testid-recovery", "text-content-matching"],
  maxAttempts: 5,
  cacheHealing: true,
});

myHealingTest("custom test", async ({ healingPage }) => {
  // Your test here
});
```

## 🎨 Healing Strategies

### 1. Data-testid Recovery

Scans the page for elements with test ID attributes and finds matches using:

- Exact matches (case-insensitive)
- Normalized matches (handles kebab-case, snake_case, camelCase)
- Substring matches
- Levenshtein distance similarity

**Example:**

```typescript
// Broken: [data-testid="submit-btn-old"]
// Heals to: [data-testid="submit-button"]
await healingPage.click('[data-testid="submit-btn-old"]');
```

### 2. Text Content Matching

Finds elements by their visible text using:

- Exact text matches
- Fuzzy matching (>80% similarity)
- Word overlap for longer texts
- Multiple selector formats (text=, :has-text(), aria-label)

**Example:**

```typescript
// Broken: text="Submit Form"
// Heals to: button:has-text("Submit")
await healingPage.click('text="Submit Form"');
```

### 3. CSS Hierarchy Analysis

Analyzes DOM structure and suggests alternatives:

- Removes brittle parts (IDs, nth-child)
- Simplifies deep hierarchies
- Uses class-only selectors
- Tries parent-child relationships

**Example:**

```typescript
// Broken: div#app > main.content > section:nth-child(3) > button#submit
// Heals to: button.submit-btn
await healingPage.click(
  "div#app > main.content > section:nth-child(3) > button#submit"
);
```

### 4. AI-Powered Analysis

Uses Ollama LLM to intelligently suggest selectors:

- Analyzes page structure
- Prioritizes stable selectors (data-testid, role, text)
- Avoids auto-generated identifiers
- Provides reasoning for suggestions

**Requires Ollama running locally:**

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull the model
ollama pull qwen2.5-coder:3b

# Verify it's running
curl http://localhost:11434/api/tags
```

## 📚 API Reference

### HealingPage

Auto-healing wrapper around Playwright's Page.

```typescript
class HealingPage {
  // Get a locator with auto-healing
  async locator(selector: string, options?: { timeout?: number }): Promise<Locator>

  // Navigation
  async goto(url: string, options?: GotoOptions): Promise<Response>

  // Actions with auto-healing
  async click(selector: string, options?: ClickOptions): Promise<void>
  async fill(selector: string, value: string, options?: FillOptions): Promise<void>
  async type(selector: string, text: string, options?: TypeOptions): Promise<void>
  async selectOption(selector: string, values: string | string[], options?): Promise<string[]>
  async check(selector: string, options?: CheckOptions): Promise<void>
  async uncheck(selector: string, options?: UncheckOptions): Promise<void>

  // Utilities
  getPage(): Page
  getEngine(): HealingEngine
  getHealingStats(): { attempts: Map<string, number>; flakiness: Array<...> }
  clearHealingCache(): void
}
```

### HealingEngine

Core healing logic orchestrator.

```typescript
class HealingEngine {
  constructor(config?: HealingConfig)

  // Heal a broken selector
  async heal(page: Page, brokenSelector: string, options?: HealingStrategyOptions): Promise<HealingResult>

  // Health check
  async healthCheck(page?: Page): Promise<{ status: string; strategies: Record<...>; cache: {...} }>

  // Statistics
  getFlakinessStats(): Array<{ selector: string; successes: number; failures: number; flakinessScore: number }>

  // Cache management
  clearCache(): void
  updateConfig(config: Partial<HealingConfig>): void
}
```

### RetryHandler

Handles intelligent retries for timeouts and flakiness.

```typescript
class RetryHandler {
  constructor(config?: HealingConfig);

  // Execute action with retry
  async withRetry<T>(
    action: () => Promise<T>,
    options?: RetryOptions
  ): Promise<T>;

  // Execute Playwright action with healing and retry
  async executeWithHealing<T>(
    page: Page,
    selector: string,
    action: (locator: Locator) => Promise<T>,
    options?: RetryOptions
  ): Promise<T>;
}
```

## 🔍 Examples

### Example 1: Login Flow with Healing

```typescript
import { healingTest, expect } from "@shifty/playwright-healing";

healingTest("user can log in", async ({ healingPage }) => {
  await healingPage.goto("https://myapp.com/login");

  // Even if selectors change, healing will fix them
  await healingPage.fill('[data-testid="email-input"]', "user@example.com");
  await healingPage.fill('[data-testid="password-input"]', "password123");
  await healingPage.click('[data-testid="login-button"]');

  // Verify redirect
  await expect(healingPage.getPage()).toHaveURL(/.*dashboard/);
});
```

### Example 2: E-commerce Checkout

```typescript
healingTest("complete purchase", async ({ healingPage }) => {
  await healingPage.goto("https://shop.example.com/cart");

  // Add items - selectors will auto-heal
  await healingPage.click('text="Add to Cart"');
  await healingPage.click(".checkout-button");

  // Fill shipping form
  await healingPage.fill("#shipping-name", "John Doe");
  await healingPage.fill("#shipping-address", "123 Main St");
  await healingPage.click('button:has-text("Continue to Payment")');

  // Complete payment
  await healingPage.fill('[data-testid="card-number"]', "4242424242424242");
  await healingPage.click('text="Complete Order"');

  // Verify success
  const confirmation = await healingPage.locator(".order-confirmation");
  await expect(confirmation).toBeVisible();
});
```

### Example 3: Custom Healing Strategy

```typescript
import { HealingEngine } from "@shifty/playwright-healing";

const engine = new HealingEngine({
  strategies: ["data-testid-recovery", "text-content-matching"], // Skip AI
  maxAttempts: 5,
  cacheHealing: true,
});

test("with custom engine", async ({ page }) => {
  const result = await engine.heal(page, "#broken-selector");

  if (result.success) {
    console.log(`Healed: ${result.selector}`);
    console.log(`Strategy: ${result.strategy}`);
    console.log(`Confidence: ${result.confidence}`);
  }
});
```

### Example 4: Retry Handler

```typescript
import { RetryHandler } from "@shifty/playwright-healing";

test("with retry handler", async ({ page }) => {
  const handler = new RetryHandler({
    retry: {
      onTimeout: true,
      onFlakiness: true,
      maxRetries: 3,
      initialBackoff: 2000,
    },
  });

  // Action will retry on timeout/flakiness
  await handler.executeWithHealing(
    page,
    "#flaky-button",
    async (locator) => {
      await locator.click();
    },
    {
      maxRetries: 3,
      onRetry: (attempt, error) => {
        console.log(`Retry ${attempt}: ${error.message}`);
      },
    }
  );
});
```

## 🐛 Troubleshooting

### Ollama Not Available

If AI-powered healing fails:

1. **Check if Ollama is running:**

   ```bash
   curl http://localhost:11434/api/tags
   ```

2. **Start Ollama:**

   ```bash
   ollama serve
   ```

3. **Pull the model:**

   ```bash
   ollama pull qwen2.5-coder:3b
   ```

4. **Configure URL if using remote Ollama:**
   ```bash
   export OLLAMA_URL=http://remote-host:11434
   ```

### Healing Not Working

1. **Enable debug logging:**

   ```bash
   export LOG_LEVEL=debug
   ```

2. **Check healing statistics:**

   ```typescript
   const stats = healingPage.getHealingStats();
   console.log("Healing attempts:", stats.attempts);
   console.log("Flakiness:", stats.flakiness);
   ```

3. **Verify configuration:**

   ```typescript
   import {
     validateConfig,
     loadHealingConfig,
   } from "@shifty/playwright-healing";

   const config = loadHealingConfig();
   const validation = validateConfig(config);

   if (!validation.valid) {
     console.error("Config errors:", validation.errors);
   }
   ```

### High Memory Usage

If caching causes memory issues:

```bash
# Disable caching
export HEALING_CACHE=false
```

Or clear cache programmatically:

```typescript
healingPage.clearHealingCache();
```

## 🤝 Contributing

Contributions are welcome! This is an open-source project under the MIT license.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/shifty-ai/shifty.git
cd shifty/packages/playwright-healing

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🔗 Links

- [Shifty Platform](https://github.com/shifty-ai/shifty)
- [Playwright Documentation](https://playwright.dev)
- [Ollama](https://ollama.com)

## ⭐ Support

If you find this package useful, please consider:

- ⭐ Starring the repository
- 🐛 Reporting issues
- 💡 Suggesting features
- 🤝 Contributing code

---

Made with ❤️ by [Shifty AI](https://github.com/shifty-ai)
