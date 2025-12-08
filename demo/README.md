# Shifty Heal Demo - SauceDemo E2E Test Suite

Comprehensive Playwright test suite for [SauceDemo](https://www.saucedemo.com/) demonstrating **autonomous test healing** with Shifty Heal.

## 🎯 Purpose

This demo showcases Shifty Heal's ability to automatically detect and fix common Playwright test issues:

- **Selector Healing**: Brittle ID/class selectors, nth-child patterns
- **Timeout Healing**: Too-short waits causing flakiness
- **Race Condition Healing**: DOM updates, state changes, badge counts
- **Async Healing**: Missing await, concurrent operations
- **Wait Strategy Optimization**: Replacing hardcoded `waitForTimeout` with proper `waitForSelector`

## 📦 Test Suite Overview

### 50+ Test Cases Across 5 Suites:

#### 1. **Login Tests** (`tests/login.spec.ts`) - 9 tests
- Standard user login
- Locked out user handling
- Invalid credential validation
- Problem user detection
- Performance glitch user (8s timeout)
- Error user handling
- Visual user testing
- Empty field validation
- Navigation verification

**Intentional Issues:**
- ⚠️ Fragile selectors: `.inventory_list`, `.app_logo`
- ⚠️ Short timeout: 5-8s for slow users
- ⚠️ No retry logic on DOM checks

#### 2. **Inventory Tests** (`tests/inventory.spec.ts`) - 11 tests
- Product display validation
- Add to cart functionality
- Remove from cart
- Cart badge updates
- Sorting (A-Z, Z-A, price low-to-high, high-to-low)
- Product detail navigation
- Multi-item cart operations
- Filter combinations

**Intentional Issues:**
- ⚠️ Hardcoded `waitForTimeout(500)` after cart operations
- ⚠️ Race conditions: badge not updated when clicked
- ⚠️ Brittle selectors: `.product_sort_container`, `#add-to-cart-sauce-labs-backpack`
- ⚠️ Short 3s timeout on sort dropdown

#### 3. **Cart Tests** (`tests/cart.spec.ts`) - 9 tests
- Add items from inventory
- Remove items from cart
- Continue shopping navigation
- Proceed to checkout
- Cart badge persistence
- Multi-item management
- Empty cart handling
- Cart state validation

**Intentional Issues:**
- ⚠️ Missing wait for DOM updates after remove
- ⚠️ Race condition: checkout button click before cart updated
- ⚠️ Fragile selector: `#continue-shopping`
- ⚠️ Loop timing issues in multi-item tests

#### 4. **Checkout Tests** (`tests/checkout.spec.ts`) - 11 tests
- Form validation (first name, last name, zip code)
- Required field errors
- Continue button functionality
- Cancel navigation
- Order summary validation
- Tax calculation verification
- Total price validation
- Order completion
- Performance glitch user flow
- Multi-user checkout scenarios

**Intentional Issues:**
- ⚠️ Short 2s timeout on continue click
- ⚠️ Race conditions: 100ms `waitForTimeout` instead of proper wait
- ⚠️ Brittle selectors: `#cancel`, `#finish`, `#first-name`
- ⚠️ Performance glitch user: 5s timeout insufficient

#### 5. **Flaky Tests** (`tests/flaky-tests.spec.ts`) - 10 tests
Intentionally flaky tests demonstrating every healing scenario:

1. **Timeout Issue**: 1s timeout (too short for DOM ready)
2. **Race Condition**: Clicking before DOM fully loaded
3. **Brittle Selector**: nth-child selectors break on DOM changes
4. **Missing Await**: Async operations without proper waiting
5. **State Pollution**: Test depending on clean cart state
6. **Hardcoded Wait**: `waitForTimeout(2000)` instead of proper wait
7. **Network Dependency**: Immediate click assuming instant load
8. **Element Instability**: Clicking during sort animation
9. **Detached Element**: DOM changes causing element detachment
10. **Concurrent Operations**: `Promise.all` without proper sequencing

## 🚀 Setup

### Prerequisites
- Node.js 20.x or later
- npm 10.x or later

### Installation

```bash
cd demo
npm install
npx playwright install --with-deps chromium
```

## 🧪 Running Tests

### All Tests
```bash
npm test
```

### Specific Test Suites
```bash
npm run test:login      # Login tests only
npm run test:checkout   # Checkout flow tests only
npm run test:flaky      # Intentionally flaky tests
```

### Headed Mode (See browser)
```bash
npm run test:headed
```

### Debug Mode
```bash
npm run test:debug
```

### CI Mode
```bash
CI=true npm test
```

## 🤖 GitHub Actions Integration

The demo includes a complete GitHub Actions workflow (`.github/workflows/playwright-healing.yml`) that:

1. **Runs tests** on every PR and push
2. **Detects failures** from flaky/brittle tests
3. **Invokes healing engine** to analyze failures
4. **Generates fixes** with confidence scores (0.0-1.0)
5. **Validates fixes** by running tests 3 times
6. **Commits healed code** to the PR branch (if confidence ≥ 0.6)
7. **Posts PR comment** with healing summary and confidence scores
8. **Verifies fixes** by re-running full test suite

### Workflow Triggers
- Pull requests to `main` or `develop`
- Pushes to `main` or `develop`
- Manual workflow dispatch

### Required Secrets
- `GITHUB_TOKEN` (automatic, no setup needed)

### Optional Configuration Variables
- `HEALING_MIN_CONFIDENCE` (default: `0.6`) - Minimum confidence score to apply fixes
- `HEALING_TELEMETRY_ENABLED` (default: `false`) - Opt-in anonymous telemetry

## 📊 Expected Test Behavior

### Without Healing
- **Expected failures**: 15-25 tests (depending on timing)
- **Failure types**: Timeouts, selector not found, race conditions, detached elements
- **Flakiness rate**: ~40% (by design)

### With Healing Engine
- **After 1st healing pass**: 80-90% tests passing
- **After 2nd healing pass**: 95-100% tests passing
- **Typical fixes**:
  - Timeouts increased from 1-3s → 10-15s
  - `waitForTimeout()` → `waitForSelector()`
  - Brittle selectors → robust data-testid or text-based
  - Missing `await` → proper async handling
  - Race conditions → explicit wait strategies

## 🔧 Healing Configuration

Create `.healing-config.json` in demo root:

```json
{
  "minConfidence": 0.5,
  "llmProvider": "ollama",
  "llmModel": "qwen2.5-coder:3b",
  "telemetryEnabled": false,
  "autoCommit": true,
  "healingStrategies": [
    "selector-healing",
    "timeout-healing",
    "wait-strategy",
    "async-healing"
  ],
  "validation": {
    "runCount": 3,
    "successThreshold": 3
  }
}
```

## 📈 Understanding Confidence Scores

Shifty Heal assigns confidence scores to each fix:

- **0.9-1.0 (🟢 High)**: AST-verified, pattern-matched, validated 3/3 runs
- **0.7-0.89 (🟡 Medium)**: Heuristic-based, validated 2/3 runs
- **0.5-0.69 (🟠 Low)**: Experimental, validated 1/3 runs
- **< 0.5 (🔴 Rejected)**: Not applied, requires manual review

Fixes with confidence ≥ `minConfidence` (default 0.6) are automatically committed.

## 🎓 SauceDemo Test Users

All users use password: `secret_sauce`

| Username | Behavior | Used In Tests |
|----------|----------|---------------|
| `standard_user` | Normal flow, no issues | All suites |
| `locked_out_user` | Denied login | Login tests |
| `problem_user` | Broken product images | Inventory tests |
| `performance_glitch_user` | Slow page loads (2-5s delays) | Login, checkout |
| `error_user` | Checkout errors | Checkout tests |
| `visual_user` | Visual regression scenarios | Login tests |

## 📁 Project Structure

```
demo/
├── .github/
│   └── workflows/
│       └── playwright-healing.yml    # Healing CI workflow
├── tests/
│   ├── fixtures.ts                   # Page object models
│   ├── login.spec.ts                 # Login test suite (9 tests)
│   ├── inventory.spec.ts             # Inventory test suite (11 tests)
│   ├── cart.spec.ts                  # Cart test suite (9 tests)
│   ├── checkout.spec.ts              # Checkout test suite (11 tests)
│   └── flaky-tests.spec.ts           # Flaky test scenarios (10 tests)
├── package.json                      # Dependencies and scripts
├── playwright.config.ts              # Playwright configuration
├── tsconfig.json                     # TypeScript configuration
└── README.md                         # This file
```

## 🐛 Debugging Failing Tests

### View test traces
```bash
npx playwright show-trace test-results/[test-name]/trace.zip
```

### View HTML report
```bash
npx playwright show-report
```

### Run single test
```bash
npx playwright test -g "should login successfully with standard_user"
```

### Run with headed browser and slow motion
```bash
npx playwright test --headed --slow-mo=500
```

## 🤝 Contributing to Healing Models

If `HEALING_TELEMETRY_ENABLED=true` in GitHub Actions, anonymized data is shared:

**Shared data:**
- Failure type (timeout, selector, race condition)
- Healing strategy used
- Confidence score
- Success/failure of fix (after validation)

**NOT shared:**
- Test code
- Application URLs
- User data
- Credentials
- Company information

This data improves healing models for the entire community. [Learn more](https://shifty.dev/oss/telemetry)

## 📚 Additional Resources

- **Shifty Heal GitHub**: https://github.com/shifty-ai/shifty-heal
- **Playwright Docs**: https://playwright.dev/
- **SauceDemo App**: https://www.saucedemo.com/
- **Healing Engine API Docs**: https://shifty.dev/docs/healing-engine

## 📝 License

This demo is part of the Shifty Heal project, licensed under [MIT with Commons Clause](../LICENSE).

---

**🤖 Built with Shifty Heal** - Autonomous test healing for Playwright
