# CI Performance Optimization Guide

## 📊 CI Run Time Comparison

### Approach 1: Standard GitHub Runner (Current)
**Setup time per run:**
- Install Ollama: ~30s
- Pull qwen2.5-coder:3b: **~5-8 minutes** (1.9GB download)
- Start Ollama: ~5s
- **Total: ~6-9 minutes overhead**

### Approach 2: Composite Action with Caching ✅ RECOMMENDED
**First run:**
- Install Ollama: ~30s
- Pull model: ~5-8 minutes
- Cache for next run
- **Total: ~6-9 minutes (first time only)**

**Subsequent runs (cached):**
- Restore Ollama from cache: ~5s
- Restore model from cache: ~3s
- Start Ollama: ~5s
- **Total: ~10-15 seconds overhead** 🚀

**Savings: ~6-9 minutes per run after first cache**

### Approach 3: Self-Hosted Runner with Pre-installed Model
**Setup time per run:**
- Start Ollama (already installed): ~5s
- Verify model (already cached): ~1s
- **Total: ~6 seconds overhead** 🚀

**Savings: ~6-9 minutes per run (always)**

## 🎯 Recommendations

### For Public OSS Projects → Use Composite Action (Approach 2)
✅ **Pros:**
- No infrastructure management
- Free GitHub Actions minutes (2000/month)
- Caching reduces overhead to ~10-15s after first run
- Easy setup (just add composite action)
- Works on standard GitHub runners

❌ **Cons:**
- First run still takes 6-9 minutes
- Cache can be evicted (7-day TTL)
- Uses GitHub Actions storage quota

**Implementation:**
```yaml
steps:
  - uses: actions/checkout@v4
  
  - name: Setup Healing Environment
    uses: ./.github/actions/setup-healing-environment
    with:
      ollama-model: 'qwen2.5-coder:3b'
      skip-model-pull: 'true'  # Use cached model
```

### For High-Volume Projects → Use Self-Hosted Runner (Approach 3)
✅ **Pros:**
- Fastest CI runs (always ~6 seconds)
- No model download ever
- Full control over resources
- Can use larger models (7b, 14b)
- Cost-effective at scale

❌ **Cons:**
- Infrastructure management required
- Initial setup complexity
- Monthly hosting costs (~$50-200/month for 3 runners)

**Implementation:**
```yaml
jobs:
  test:
    runs-on: [self-hosted, shifty-heal, ollama]
    # Rest of workflow...
```

## 📈 Cost Analysis

### GitHub-Hosted with Caching (Approach 2)
**Assumptions:**
- 100 CI runs/month
- First run: 9 minutes, cached runs: 15 seconds

**Compute time:**
- First run: 9 minutes
- Next 99 runs: 99 × 0.25 minutes = 24.75 minutes
- **Total: ~34 minutes/month**

**Cost:** Free tier covers 2000 minutes/month ✅

### Self-Hosted Runner (Approach 3)
**Infrastructure:**
- 1 × c5.xlarge (4 vCPU, 8GB RAM): ~$140/month
- Or 1 × DigitalOcean Droplet (4 vCPU, 8GB): ~$48/month

**Compute time:**
- 100 runs × 6 seconds = 10 minutes/month
- But runner runs 24/7: **$48-140/month fixed cost**

**Break-even:** ~500+ CI runs/month

## 🚀 Quick Setup

### Option 1: Composite Action (Recommended for Most Users)

Already configured in your workflow! The composite action:
- ✅ Installs Ollama
- ✅ Caches installation and model
- ✅ Starts Ollama service
- ✅ Verifies model availability

No additional setup needed. Just push and go! 🎉

### Option 2: Self-Hosted Runner

#### 1. Build Custom Runner Image
```bash
cd /Users/home/Projects/shifty-heal
docker build -f .github/Dockerfile.healing-runner -t ghcr.io/shifty-ai/shifty-heal-runner:latest .
```

#### 2. Push to Container Registry
```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u shifty-ai --password-stdin
docker push ghcr.io/shifty-ai/shifty-heal-runner:latest
```

#### 3. Deploy Runner
```bash
# Get runner token from GitHub:
# https://github.com/shifty-ai/shifty-heal/settings/actions/runners/new

export RUNNER_TOKEN="YOUR_TOKEN"
export GITHUB_REPOSITORY="shifty-ai/shifty-heal"

docker run -d \
  --name shifty-heal-runner \
  --restart unless-stopped \
  -e GITHUB_REPOSITORY=$GITHUB_REPOSITORY \
  -e RUNNER_TOKEN=$RUNNER_TOKEN \
  -e RUNNER_NAME="shifty-heal-runner-01" \
  -v /var/run/docker.sock:/var/run/docker.sock \
  ghcr.io/shifty-ai/shifty-heal-runner:latest
```

#### 4. Update Workflow
```yaml
jobs:
  heal:
    runs-on: [self-hosted, shifty-heal, ollama]  # Use custom runner
    steps:
      # Ollama already running with model loaded!
      - uses: actions/checkout@v4
      - run: npm test
```

See [CUSTOM_RUNNER_SETUP.md](.github/docs/CUSTOM_RUNNER_SETUP.md) for detailed instructions.

## 🔍 Monitoring

### Check Cache Hit Rate

View GitHub Actions cache usage:
```
https://github.com/shifty-ai/shifty-heal/actions/caches
```

### Measure CI Performance

Add to workflow:
```yaml
- name: Start timing
  run: echo "START_TIME=$(date +%s)" >> $GITHUB_ENV

# ... your steps ...

- name: Calculate duration
  if: always()
  run: |
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    echo "⏱️ Total time: ${DURATION}s"
```

## 🎓 Best Practices

1. **Use composite action by default** - Works for 95% of projects
2. **Monitor cache hit rate** - Should be >90% after initial runs
3. **Consider self-hosted for high-volume** - Break-even at ~500 runs/month
4. **Version your runner images** - Tag with semantic versions for stability
5. **Set up monitoring** - Track CI performance over time

## 📚 Additional Resources

- [Custom Runner Setup Guide](.github/docs/CUSTOM_RUNNER_SETUP.md)
- [GitHub Actions Caching](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)
- [Self-Hosted Runners](https://docs.github.com/en/actions/hosting-your-own-runners)
- [Ollama Docker Setup](https://github.com/ollama/ollama/blob/main/docs/docker.md)

---

**Current setup:** ✅ Composite action with caching (Approach 2)
**Estimated overhead:** ~10-15 seconds (after first run)
**Cache TTL:** 7 days (automatically refreshed on each run)
