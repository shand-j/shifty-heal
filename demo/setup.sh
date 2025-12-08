#!/bin/bash

# Shifty Heal Demo - Setup Script
# Installs dependencies and configures the demo environment

set -e

echo "🚀 Setting up Shifty Heal Demo..."

# Check Node.js version
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "❌ Error: Node.js 20.x or later required (found: $(node -v))"
  exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Install Playwright browsers
echo ""
echo "🎭 Installing Playwright browsers..."
npx playwright install --with-deps chromium

# Verify installation
echo ""
echo "🔍 Verifying installation..."

if [ ! -d "node_modules/@playwright/test" ]; then
  echo "❌ Playwright installation failed"
  exit 1
fi

echo "✅ Playwright installed"

# Check for healing engine (optional)
echo ""
echo "🔧 Checking for Shifty Heal engine..."

if command -v docker &> /dev/null; then
  if docker ps | grep -q shifty-heal-engine; then
    echo "✅ Healing engine is running"
  else
    echo "⚠️  Healing engine not running"
    echo "   To start: docker run -d -p 8080:8080 coglabs/shifty-heal:latest"
  fi
else
  echo "⚠️  Docker not found - healing engine requires Docker"
fi

# Display next steps
echo ""
echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Run tests:           npm test"
echo "  2. Run login tests:     npm run test:login"
echo "  3. Run flaky tests:     npm run test:flaky"
echo "  4. View in browser:     npm run test:headed"
echo "  5. Debug mode:          npm run test:debug"
echo ""
echo "Expected behavior:"
echo "  - ~15-25 tests will fail (intentionally flaky)"
echo "  - Failures include: timeouts, selectors, race conditions"
echo "  - Healing engine will auto-fix on GitHub Actions runs"
echo ""
echo "📚 See README.md for full documentation"
