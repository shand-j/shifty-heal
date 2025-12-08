# Shifty Healing Engine

**Autonomous test healing service** for Playwright tests. Analyzes test failures and generates healed code using LLM-powered strategies.

## 🚀 Quick Start

### Using Docker (Recommended)

```bash
# Start Ollama locally
ollama serve
ollama pull qwen2.5-coder:3b

# Run healing engine
docker run -d \
  --name shifty-heal-engine \
  -p 8080:8080 \
  -e OLLAMA_ENDPOINT=http://host.docker.internal:11434 \
  -e HEALING_LLM_MODEL=qwen2.5-coder:3b \
  --add-host=host.docker.internal:host-gateway \
  coglabs/shifty-heal:latest

# Check health
curl http://localhost:8080/health
```

### Using Node.js

```bash
cd healing-engine
npm install
npm run build

# Start Ollama in another terminal
ollama serve
ollama pull qwen2.5-coder:3b

# Start healing engine
OLLAMA_ENDPOINT=http://localhost:11434 npm start
```

## 📡 API Endpoints

### Health Check
```bash
GET /health
GET /api/version
```

### Analyze and Heal
```bash
POST /api/healing/analyze

{
  "testFile": "tests/login.spec.ts",
  "testTitle": "should login successfully",
  "errorMessage": "Timeout 2000ms exceeded",
  "errorStack": "...",
  "failedSelector": "#username",
  "failureType": "timeout",
  "testCode": "await page.locator('#username').fill('user');",
  "healingStrategies": ["timeout-healing", "selector-healing"]
}
```

**Response:**
```json
{
  "healedCode": "await page.locator('#username').waitFor({ state: 'visible' });\nawait page.locator('#username').fill('user');",
  "confidence": 0.85,
  "strategy": "wait-strategy-heuristic",
  "explanation": "Added explicit wait for element visibility",
  "changes": [
    {
      "type": "wait-before-action",
      "before": "await page.locator('#username').fill('user');",
      "after": "await page.locator('#username').waitFor({ state: 'visible' });\nawait page.locator('#username').fill('user');",
      "reason": "Added explicit wait for element visibility before fill"
    }
  ]
}
```

## 🧠 Healing Strategies

### 1. Timeout Healing (`timeout-healing`)
**Detects:** Timeout errors, slow page loads
**Fixes:**
- Increases timeout values (2s → 10s → 15s)
- Adds explicit timeouts where missing
- Uses network idle detection

**Confidence:** 0.7-0.9

### 2. Selector Healing (`selector-healing`)
**Detects:** Element not found, detached elements
**Fixes:**
- Replaces brittle selectors (nth-child, IDs)
- Adds `waitFor()` before operations
- Uses robust selectors (data-testid, role, text)

**Confidence:** 0.6-0.8

### 3. Wait Strategy Optimization (`wait-strategy`)
**Detects:** Race conditions, timing issues
**Fixes:**
- Replaces `waitForTimeout()` with proper waits
- Adds `waitForLoadState('networkidle')`
- Adds `waitFor({ state: 'visible' })` before interactions

**Confidence:** 0.75-0.9

### 4. Async Healing (`async-healing`)
**Detects:** Missing await, Promise.all issues
**Fixes:**
- Adds missing `await` keywords
- Converts Promise.all to sequential operations
- Ensures proper async/await patterns

**Confidence:** 0.7-0.85

## 🎯 Failure Type Detection

| Failure Type | Auto-Detected From | Recommended Strategy |
|--------------|-------------------|---------------------|
| `timeout` | "Timeout exceeded", "wait timeout" | `timeout-healing` |
| `selector` | "element not found", "locator" | `selector-healing` |
| `detached-element` | "detached", "stale element" | `selector-healing` |
| `race-condition` | "badge count", "DOM update" | `wait-strategy` |
| `network` | "network", "request failed" | `timeout-healing` |

## 🔧 Configuration

### Environment Variables

```bash
PORT=8080                           # Server port
HOST=0.0.0.0                       # Bind host
OLLAMA_ENDPOINT=http://localhost:11434  # Ollama API endpoint
HEALING_LLM_MODEL=qwen2.5-coder:3b # LLM model
HEALING_TELEMETRY_ENABLED=false    # Opt-in telemetry
LOG_LEVEL=info                     # Logging level (debug, info, warn, error)
```

## 📊 Confidence Scoring

Confidence scores indicate reliability of healed code:

- **0.9-1.0 🟢** - AST-verified, pattern-matched, high reliability
- **0.7-0.89 🟡** - Heuristic-based, validated patterns
- **0.5-0.69 🟠** - LLM-generated, experimental
- **< 0.5 🔴** - Not recommended, manual review needed

Healing results with `confidence >= minConfidence` (default: 0.6) are applied automatically.

## 🧪 Testing Locally

```bash
# Start services
ollama serve &
ollama pull qwen2.5-coder:3b
cd healing-engine && npm start &

# Test healing endpoint
curl -X POST http://localhost:8080/api/healing/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "testFile": "tests/example.spec.ts",
    "testTitle": "test name",
    "errorMessage": "Timeout 2000ms exceeded",
    "failedSelector": "#btn",
    "failureType": "timeout",
    "testCode": "await page.locator(\"#btn\").click();",
    "healingStrategies": ["timeout-healing"]
  }'
```

## 🐳 Building Docker Image

```bash
# Build locally
./build-healing-engine.sh

# Build and push to registry
./build-healing-engine.sh --push

# Or manually
docker build -f Dockerfile.healing-engine -t coglabs/shifty-heal:latest .
docker push coglabs/shifty-heal:latest
```

## 📚 Integration with CI/CD

See [demo/.github/workflows/playwright-healing.yml](../demo/.github/workflows/playwright-healing.yml) for complete GitHub Actions integration example.

**Key steps:**
1. Run Playwright tests (some fail)
2. Start Ollama with qwen2.5-coder:3b
3. Start healing engine container
4. Analyze failures via API
5. Apply healed code
6. Commit fixes to PR

## 🔍 Architecture

```
┌─────────────────────┐
│  GitHub Actions     │
│  (Test Runner)      │
└──────────┬──────────┘
           │ POST /api/healing/analyze
           ▼
┌─────────────────────┐
│  Healing Engine     │
│  (Fastify Server)   │
├─────────────────────┤
│ • Timeout Healing   │
│ • Selector Healing  │
│ • Wait Strategy     │
│ • Async Healing     │
└──────────┬──────────┘
           │ LLM API calls
           ▼
┌─────────────────────┐
│  Ollama             │
│  (qwen2.5-coder:3b) │
└─────────────────────┘
```

## 🤝 Contributing

Built for the Shifty Heal OSS project. See [main README](../README.md) for contribution guidelines.

## 📝 License

MIT with Commons Clause - See [LICENSE](../LICENSE)

---

**Built with:**
- Fastify (Web framework)
- Ollama (LLM inference)
- TypeScript (Type safety)
- Zod (Request validation)

**Part of:** [Shifty Heal](https://github.com/shifty-ai/shifty-heal) - Autonomous test healing for Playwright
