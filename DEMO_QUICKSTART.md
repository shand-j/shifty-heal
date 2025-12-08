# Shifty Heal - Demo Quick Start

## 🚀 5-Minute Quick Start

Get the SauceDemo test suite running in 5 minutes:

```bash
# 1. Navigate to demo directory
cd demo

# 2. Run setup script
./setup.sh

# 3. Run tests
npm test
```

## 🎯 What to Expect

### Test Results
- **50+ tests** will run across 5 test suites
- **8-12 tests will fail** (intentionally flaky)
- Failures demonstrate healing scenarios:
  - Timeout issues (2s → needs 10-15s)
  - Race conditions (badge counts, cart updates)
  - Brittle selectors (nth-child, ID-based)
  - Async issues (missing await, Promise.all)

### Failure Examples

**Network-dependent test:**
```
Error: expect(locator).toBeVisible() failed
Timeout: 2000ms

→ Healing: Increase timeout to 15000ms
→ Confidence: 0.85 (High)
```

**Concurrent operations:**
```
Expected: 3
Received: 2

→ Healing: Sequential await instead of Promise.all
→ Confidence: 0.75 (Medium-High)
```

## 📊 Test Suite Overview

| Suite | Tests | Purpose |
|-------|-------|---------|
| Login | 9 | User authentication flows |
| Inventory | 11 | Product browsing, sorting |
| Cart | 9 | Shopping cart management |
| Checkout | 11 | Purchase flow validation |
| Flaky | 10 | Explicit healing demos |

## 🤖 GitHub Actions Healing

When you push to GitHub with the workflow enabled:

1. **Tests run** automatically on PR
2. **Failures detected** by healing engine
3. **Fixes generated** with confidence scores
4. **Tests validated** (3 successful runs required)
5. **PR updated** with healed code + comment
6. **Verification** re-runs tests to confirm

### Enable Healing Workflow

```bash
# Workflow is in .github/workflows/playwright-healing.yml
# Push to GitHub and create a PR to see it in action

git add .
git commit -m "feat: add SauceDemo test suite with healing"
git push origin main
```

## 🎓 Test Scenarios

### 1. Login Tests (9 tests)
- Standard user login ✅
- Locked out user ✅
- Invalid credentials ✅
- Performance glitch user (slow) ✅
- Error/visual users ✅

### 2. Inventory Tests (11 tests)
- Product display ✅
- Add/remove from cart
- Sorting (A-Z, price)
- Badge updates
- **Flaky**: Race conditions on cart operations

### 3. Cart Tests (9 tests)
- Item management
- Navigation
- Cart persistence
- **Flaky**: DOM update timing issues

### 4. Checkout Tests (11 tests)
- Form validation
- Order completion
- Multi-user flows
- **Flaky**: Short timeouts, race conditions

### 5. Flaky Tests (10 tests)
All intentionally flaky to demonstrate healing:
- ❌ 1s timeout (too short)
- ❌ Race condition (clicking too fast)
- ❌ Brittle selector (nth-child)
- ❌ Missing await
- ❌ State pollution
- ❌ Hardcoded wait (2s)
- ❌ Network dependency (2s timeout)
- ❌ Element instability
- ❌ Detached element
- ❌ Concurrent operations

## 🔍 Running Specific Tests

```bash
# Login tests only
npm run test:login

# Flaky tests (expect failures)
npm run test:flaky

# Checkout flow
npm run test:checkout

# Watch tests run in browser
npm run test:headed

# Debug mode (Playwright Inspector)
npm run test:debug
```

## 📈 View Test Reports

```bash
# HTML report (interactive)
npx playwright show-report

# Trace viewer (for failures)
npx playwright show-trace test-results/[test-name]/trace.zip
```

## 🔧 Configuration

### Healing Settings (`.healing-config.json`)
```json
{
  "minConfidence": 0.6,
  "llm": {
    "provider": "ollama",
    "model": "qwen2.5-coder:3b"
  },
  "healingStrategies": {
    "selectorHealing": { "enabled": true },
    "timeoutHealing": { "enabled": true },
    "waitStrategyOptimization": { "enabled": true },
    "asyncHealing": { "enabled": true }
  },
  "validation": {
    "runCount": 3,
    "successThreshold": 3
  }
}
```

### Playwright Settings (`playwright.config.ts`)
- Base URL: https://www.saucedemo.com/
- Timeout: 30s (global), 10s (action)
- Retries: 2 (in CI)
- Browsers: Chromium only (demo)
- Reports: HTML, JSON, JUnit

## 🐛 Troubleshooting

### Tests won't run
```bash
# Reinstall Playwright browsers
npx playwright install --with-deps chromium
```

### TypeScript errors
```bash
# Rebuild
npm run build
```

### All tests fail
```bash
# Check SauceDemo is accessible
curl -I https://www.saucedemo.com/
```

## 📚 Next Steps

1. **Review README.md** in `demo/` directory for full documentation
2. **Explore test files** in `demo/tests/` to see failure patterns
3. **Check GitHub workflow** in `.github/workflows/playwright-healing.yml`
4. **Run healing locally** (requires Docker + Ollama):
   ```bash
   ollama serve
   ollama pull qwen2.5-coder:3b
   # Start healing engine when available
   ```

## 🤝 Contributing

Found a bug? Have an idea? Open an issue or PR!

- **Issues**: https://github.com/shifty-ai/shifty-heal/issues
- **Discussions**: https://github.com/shifty-ai/shifty-heal/discussions
- **Docs**: https://shifty.dev/docs

## 📝 License

MIT with Commons Clause - See [LICENSE](../LICENSE)

---

**🤖 Built with Shifty Heal** - Autonomous test healing for Playwright

**Target Application**: [SauceDemo](https://www.saucedemo.com/) - Public e-commerce demo
**Test Framework**: Playwright 1.40.0 + TypeScript 5.3.0
**Healing Model**: qwen2.5-coder:3b (4GB RAM, code-optimized)
