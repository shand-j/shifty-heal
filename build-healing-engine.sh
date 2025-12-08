# Healing Engine Build and Deploy Script

set -e

echo "🏗️  Building Shifty Healing Engine..."

# Build the healing engine
cd healing-engine
npm install
npm run build
cd ..

# Build Docker image
echo "🐳 Building Docker image..."
docker build -f Dockerfile.healing-engine -t coglabs/shifty-heal:latest .

# Tag with version
VERSION=$(node -p "require('./healing-engine/package.json').version")
docker tag coglabs/shifty-heal:latest coglabs/shifty-heal:v$VERSION

echo "✅ Built coglabs/shifty-heal:latest and coglabs/shifty-heal:v$VERSION"

# Optional: Push to registry
if [ "$1" == "--push" ]; then
  echo "📤 Pushing to Docker Hub..."
  docker push coglabs/shifty-heal:latest
  docker push coglabs/shifty-heal:v$VERSION
  echo "✅ Images pushed successfully"
fi

echo ""
echo "To test locally:"
echo "  docker run -d -p 8080:8080 -e OLLAMA_ENDPOINT=http://host.docker.internal:11434 coglabs/shifty-heal:latest"
echo ""
echo "To push to registry:"
echo "  ./build-healing-engine.sh --push"
