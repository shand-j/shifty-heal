# Custom GitHub Actions Runner Setup

This guide explains how to set up and use the custom GitHub Actions runner with pre-installed Ollama and qwen2.5-coder:3b model.

## 🎯 Benefits

- **5-10 minutes faster** CI runs (no model download)
- **Consistent environment** across all runs
- **Pre-cached dependencies** (Playwright, Node.js 20)
- **Ollama ready** to start immediately

## 🏗️ Build Custom Runner Image

### Option 1: GitHub Container Registry (Recommended)

```bash
# Build and push to GitHub Container Registry
cd /Users/home/Projects/shifty-heal

docker build -f .github/Dockerfile.healing-runner -t ghcr.io/shifty-ai/shifty-heal-runner:latest .

# Authenticate with GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Push image
docker push ghcr.io/shifty-ai/shifty-heal-runner:latest

# Tag with version
docker tag ghcr.io/shifty-ai/shifty-heal-runner:latest ghcr.io/shifty-ai/shifty-heal-runner:v1.0.0
docker push ghcr.io/shifty-ai/shifty-heal-runner:v1.0.0
```

### Option 2: Docker Hub

```bash
docker build -f .github/Dockerfile.healing-runner -t shiftyai/healing-runner:latest .
docker push shiftyai/healing-runner:latest
```

## 🚀 Deploy Self-Hosted Runner

### GitHub-Hosted (Using Container Jobs)

Your workflow can use the pre-built container:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    container:
      image: ghcr.io/shifty-ai/shifty-heal-runner:latest
    steps:
      - uses: actions/checkout@v4
      # Ollama is already running with qwen2.5-coder:3b loaded
      - name: Run tests
        run: npm test
```

### Self-Hosted Runner on Your Infrastructure

#### Using Docker

```bash
# Generate GitHub runner token from:
# https://github.com/shifty-ai/shifty-heal/settings/actions/runners/new

export GITHUB_REPOSITORY="shifty-ai/shifty-heal"
export RUNNER_TOKEN="YOUR_GITHUB_RUNNER_TOKEN"
export RUNNER_NAME="shifty-heal-runner-01"

docker run -d \
  --name shifty-heal-runner \
  --restart unless-stopped \
  -e GITHUB_REPOSITORY=$GITHUB_REPOSITORY \
  -e RUNNER_TOKEN=$RUNNER_TOKEN \
  -e RUNNER_NAME=$RUNNER_NAME \
  -v /var/run/docker.sock:/var/run/docker.sock \
  ghcr.io/shifty-ai/shifty-heal-runner:latest
```

#### Using Docker Compose

Create `docker-compose.runner.yml`:

```yaml
version: '3.8'

services:
  shifty-heal-runner-1:
    image: ghcr.io/shifty-ai/shifty-heal-runner:latest
    container_name: shifty-heal-runner-1
    restart: unless-stopped
    environment:
      - GITHUB_REPOSITORY=shifty-ai/shifty-heal
      - RUNNER_TOKEN=${RUNNER_TOKEN}
      - RUNNER_NAME=shifty-heal-runner-1
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    labels:
      - "com.shifty.runner=true"

  # Scale with multiple runners
  shifty-heal-runner-2:
    image: ghcr.io/shifty-ai/shifty-heal-runner:latest
    container_name: shifty-heal-runner-2
    restart: unless-stopped
    environment:
      - GITHUB_REPOSITORY=shifty-ai/shifty-heal
      - RUNNER_TOKEN=${RUNNER_TOKEN}
      - RUNNER_NAME=shifty-heal-runner-2
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    labels:
      - "com.shifty.runner=true"
```

Start runners:

```bash
export RUNNER_TOKEN="YOUR_GITHUB_RUNNER_TOKEN"
docker-compose -f docker-compose.runner.yml up -d
```

### Kubernetes Deployment

Create `k8s-runner-deployment.yml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shifty-heal-runner
  namespace: github-runners
spec:
  replicas: 3
  selector:
    matchLabels:
      app: shifty-heal-runner
  template:
    metadata:
      labels:
        app: shifty-heal-runner
    spec:
      containers:
      - name: runner
        image: ghcr.io/shifty-ai/shifty-heal-runner:latest
        env:
        - name: GITHUB_REPOSITORY
          value: "shifty-ai/shifty-heal"
        - name: RUNNER_TOKEN
          valueFrom:
            secretKeyRef:
              name: github-runner-token
              key: token
        - name: RUNNER_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        volumeMounts:
        - name: docker-sock
          mountPath: /var/run/docker.sock
        resources:
          requests:
            memory: "6Gi"
            cpu: "2"
          limits:
            memory: "8Gi"
            cpu: "4"
      volumes:
      - name: docker-sock
        hostPath:
          path: /var/run/docker.sock
          type: Socket
```

## 🔧 Using Custom Runner in Workflows

Update `.github/workflows/playwright-healing.yml`:

```yaml
jobs:
  test:
    name: Run Playwright Tests
    runs-on: [self-hosted, shifty-heal, ollama]  # Use custom labels
    # OR for container jobs:
    # runs-on: ubuntu-latest
    # container:
    #   image: ghcr.io/shifty-ai/shifty-heal-runner:latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Verify Ollama is ready
        run: |
          curl -f http://localhost:11434/api/version
          ollama list | grep qwen2.5-coder:3b
      
      - name: Install dependencies
        working-directory: ./demo
        run: npm ci
      
      - name: Run tests
        working-directory: ./demo
        run: npm test
```

## 📊 Performance Comparison

### Standard GitHub Runner
```
Install Ollama:          ~30 seconds
Pull qwen2.5-coder:3b:   ~5-8 minutes (1.9GB download)
Start Ollama:            ~5 seconds
Total overhead:          ~6-9 minutes
```

### Custom Runner
```
Start Ollama:            ~5 seconds
Verify model:            ~1 second
Total overhead:          ~6 seconds
```

**Savings: ~6-9 minutes per CI run** 🚀

## 🔐 Security Considerations

1. **Runner Token Rotation**: Tokens expire after 1 hour. Use GitHub Apps for automatic token refresh.

2. **Secrets Management**: Store `RUNNER_TOKEN` in GitHub Secrets, not in code:
   ```bash
   # In GitHub repository settings
   Settings → Secrets and variables → Actions → New repository secret
   Name: RUNNER_TOKEN
   Value: [your token]
   ```

3. **Network Isolation**: Run runners in a private network if handling sensitive data.

4. **Resource Limits**: Set memory/CPU limits to prevent resource exhaustion:
   ```bash
   docker run --memory="8g" --cpus="4" ...
   ```

## 🔍 Monitoring

### Check Runner Status

```bash
# View logs
docker logs shifty-heal-runner -f

# Check Ollama health
docker exec shifty-heal-runner curl http://localhost:11434/api/version

# List loaded models
docker exec shifty-heal-runner ollama list
```

### GitHub Runner Status

Check runner status at:
```
https://github.com/shifty-ai/shifty-heal/settings/actions/runners
```

## 🛠️ Maintenance

### Update Model

```bash
# Rebuild image with updated model
docker build -f .github/Dockerfile.healing-runner --no-cache -t ghcr.io/shifty-ai/shifty-heal-runner:v1.1.0 .
docker push ghcr.io/shifty-ai/shifty-heal-runner:v1.1.0

# Restart runners
docker-compose -f docker-compose.runner.yml down
docker-compose -f docker-compose.runner.yml up -d
```

### Scale Runners

```bash
# Scale to 5 runners
docker-compose -f docker-compose.runner.yml up -d --scale shifty-heal-runner-1=5
```

## 📝 Troubleshooting

### Runner not appearing in GitHub

1. Check token is valid (expires after 1 hour)
2. Verify `GITHUB_REPOSITORY` is correct
3. Check container logs: `docker logs shifty-heal-runner`

### Ollama not responding

```bash
# Check Ollama service
docker exec shifty-heal-runner ps aux | grep ollama

# Restart Ollama
docker exec shifty-heal-runner killall ollama
docker exec shifty-heal-runner ollama serve &
```

### Model not found

```bash
# Re-pull model
docker exec shifty-heal-runner ollama pull qwen2.5-coder:3b
```

## 🎓 Advanced Configuration

### Using Composite Action (Recommended for GitHub-hosted)

Your workflow can use the composite action we created:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Healing Environment
        uses: ./.github/actions/setup-healing-environment
        with:
          ollama-model: 'qwen2.5-coder:3b'
          skip-model-pull: 'true'  # Use cached model
      
      - name: Run tests
        run: npm test
```

This approach:
- ✅ Works with standard GitHub runners
- ✅ Caches Ollama installation and model
- ✅ Reduces overhead to ~1-2 minutes (first run) or ~10 seconds (cached)

## 📚 Resources

- [GitHub Actions Self-hosted Runners](https://docs.github.com/en/actions/hosting-your-own-runners)
- [Ollama Documentation](https://github.com/ollama/ollama)
- [Docker GitHub Actions](https://docs.github.com/en/actions/using-containerized-services)

---

**Need help?** Open an issue at https://github.com/shifty-ai/shifty-heal/issues
