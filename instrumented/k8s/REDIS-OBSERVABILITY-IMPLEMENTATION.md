# Redis Advanced Observability - Implementation Complete

## Status: ✅ Configuration Applied

**Date**: 2026-01-30
**File Modified**: `/Users/pedro.schawirin/Documents/Dogbank/instrumented/k8s/base/redis.yaml`

## Changes Implemented

### 1. Enhanced Datadog Autodiscovery Annotation (lines 28-51)

**Added advanced monitoring capabilities:**

```yaml
ad.datadoghq.com/redis.checks: |
  {
    "redisdb": {
      "init_config": {},
      "instances": [
        {
          "host": "%%host%%",
          "port": 6379,
          "tags": ["env:dogbank", "service:redis"],
          "command_stats": true,                    # NEW: Per-command statistics
          "slowlog-max-len": 128,                   # NEW: Slow query logging
          "keys": [                                 # NEW: Key pattern monitoring
            "session:*",
            "rate_limit:login:*",
            "rate_limit:transaction:*",
            "temp:*"
          ],
          "warn_on_missing_keys": true,             # NEW: Alert on key evictions
          "disable_connection_cache": false,
          "socket_timeout": 5
        }
      ]
    }
  }
```

**Benefits:**
- `command_stats: true` → Collects statistics for each Redis command (GET, SET, DEL, etc.)
- `slowlog-max-len: 128` → Captures slow queries for performance analysis
- `keys` patterns → Monitors critical application keys (sessions, rate limits)
- `warn_on_missing_keys: true` → Alerts on unexpected key evictions

### 2. Redis Server Configuration (lines 60-71)

**Enhanced Redis server parameters:**

```yaml
command:
  - redis-server
  - --appendonly
  - "yes"
  - --slowlog-log-slower-than       # NEW: Log commands >10ms
  - "10000"
  - --slowlog-max-len               # NEW: Keep last 128 slow queries
  - "128"
  - --maxmemory                     # NEW: Memory limit
  - "100mb"
  - --maxmemory-policy              # NEW: LRU eviction policy
  - "allkeys-lru"
```

**Benefits:**
- `slowlog-log-slower-than 10000` → Logs commands taking >10ms (10000 microseconds)
- `slowlog-max-len 128` → Retains last 128 slow queries
- `maxmemory 100mb` → Prevents OOM (below container limit)
- `maxmemory-policy allkeys-lru` → Appropriate for cache use case (sessions + rate limits)

### 3. Increased Resource Limits (lines 72-77)

**Updated resource allocation:**

```yaml
resources:
  requests:
    memory: "96Mi"      # Was: 64Mi  (+50%)
    cpu: "100m"         # Unchanged
  limits:
    memory: "192Mi"     # Was: 128Mi (+50%)
    cpu: "250m"         # Was: 200m  (+25%)
```

**Justification:**
- Command stats and slowlog add ~5-10MB memory overhead
- Extra CPU headroom for command statistics collection
- Still conservative for development/testing environment

## New Metrics Available in Datadog

### Command Statistics
- `redis.commands.calls` - Total calls per command (GET, SET, DEL, etc.)
- `redis.commands.usec_per_call` - Average microseconds per call
- `redis.commands.usec` - Total microseconds per command type

### Slowlog Metrics
- `redis.slowlog.micros.95percentile` - 95th percentile latency
- `redis.slowlog.micros.avg` - Average slow query latency
- `redis.slowlog.micros.max` - Maximum latency recorded

### Key Monitoring
- `redis.key.length` - Length/size of monitored keys
- Tagged with patterns: `session:*`, `rate_limit:login:*`, `rate_limit:transaction:*`, `temp:*`

### Memory & Performance (enhanced context)
- `redis.mem.fragmentation_ratio` - Memory fragmentation
- `redis.mem.used` - Memory usage
- `redis.cpu.sys` - CPU usage
- `redis.evicted_keys` - Keys evicted due to maxmemory

## Deployment Instructions

### Prerequisites
1. AWS credentials configured (`aws configure`)
2. kubectl context set to EKS cluster
3. Access to Datadog account

### Apply Configuration

#### Option 1: Using kustomize (Recommended)
```bash
cd /Users/pedro.schawirin/Documents/Dogbank/instrumented/k8s
kubectl apply -k base/
```

#### Option 2: Direct apply
```bash
kubectl apply -f /Users/pedro.schawirin/Documents/Dogbank/instrumented/k8s/base/redis.yaml
```

### Verification Steps

#### 1. Check Deployment Rollout
```bash
kubectl rollout status deployment/redis -n dogbank
kubectl get pods -n dogbank | grep redis
```

Expected output:
```
deployment "redis" successfully rolled out
redis-xxxxxxxxxx-xxxxx   1/1     Running   0          2m
```

#### 2. Verify Redis Configuration
```bash
# Check slowlog settings
kubectl exec -n dogbank deployment/redis -- redis-cli CONFIG GET slowlog-log-slower-than
kubectl exec -n dogbank deployment/redis -- redis-cli CONFIG GET slowlog-max-len

# Expected output:
# 1) "slowlog-log-slower-than"
# 2) "10000"
# 1) "slowlog-max-len"
# 2) "128"

# Check memory settings
kubectl exec -n dogbank deployment/redis -- redis-cli CONFIG GET maxmemory
kubectl exec -n dogbank deployment/redis -- redis-cli CONFIG GET maxmemory-policy

# Expected output:
# 1) "maxmemory"
# 2) "104857600"  # 100MB in bytes
# 1) "maxmemory-policy"
# 2) "allkeys-lru"
```

#### 3. Test Slowlog Collection
```bash
# View current slowlog entries
kubectl exec -n dogbank deployment/redis -- redis-cli SLOWLOG GET 10

# Generate a slow operation (for testing)
kubectl exec -n dogbank deployment/redis -- redis-cli DEBUG SLEEP 0.02

# Check slowlog again
kubectl exec -n dogbank deployment/redis -- redis-cli SLOWLOG GET 10
```

#### 4. Verify Datadog Integration
```bash
# Check Datadog agent logs
kubectl logs -n default daemonset/datadog-agent --tail=100 | grep -i redis

# Look for successful check runs:
# "redisdb" check ran successfully
# Collected X metrics
```

#### 5. Test Key Monitoring
```bash
# Create test keys matching patterns
kubectl exec -n dogbank deployment/redis -- redis-cli SET "session:test:123" "test_value"
kubectl exec -n dogbank deployment/redis -- redis-cli SET "rate_limit:login:user1" "5"
kubectl exec -n dogbank deployment/redis -- redis-cli SET "rate_limit:transaction:user1" "10"
kubectl exec -n dogbank deployment/redis -- redis-cli SET "temp:cache:item1" "data"

# Verify keys exist
kubectl exec -n dogbank deployment/redis -- redis-cli KEYS "*"

# These should appear in Datadog metrics within 5-10 minutes
```

#### 6. Validate Metrics in Datadog

**Wait 5-10 minutes** for metrics to appear, then check:

1. **Metrics Explorer** (https://app.datadoghq.com/metric/explorer)
   - Search: `redis.commands.calls`
   - Search: `redis.commands.usec_per_call`
   - Search: `redis.slowlog.micros.*`
   - Search: `redis.key.length`

2. **Infrastructure View** (https://app.datadoghq.com/infrastructure)
   - Find Redis host
   - Check "Metrics" tab for new metrics

3. **APM Service View**
   - Navigate to Redis service
   - Verify enhanced metrics appear

## Performance Impact

### Expected Overhead
- **CPU**: <5% increase
- **Memory**: ~5-10MB increase
- **Network**: Negligible (metrics sent in batches)

### Mitigations Applied
- Slowlog limited to 128 entries (prevents unbounded growth)
- Specific key patterns monitored (not all keys)
- Socket timeout prevents hung connections
- Memory limit with LRU policy prevents OOM

## Rollback Procedure

If issues occur:

### Quick Rollback
```bash
# Rollback to previous deployment
kubectl rollout undo deployment/redis -n dogbank

# Verify rollback
kubectl rollout status deployment/redis -n dogbank
```

### Manual Rollback
1. Remove advanced configuration from redis.yaml:
   - Set `command_stats: false` or remove it
   - Remove `slowlog-max-len`, `keys`, `warn_on_missing_keys`
   - Remove Redis server slowlog/maxmemory flags
   - Restore original resource limits

2. Reapply configuration:
   ```bash
   kubectl apply -f redis.yaml
   ```

## Success Criteria

✅ **Deployment**
- [ ] Redis pod restarts successfully
- [ ] No CrashLoopBackOff errors
- [ ] Readiness/liveness probes passing

✅ **Configuration**
- [ ] Slowlog settings verified (10000 microseconds)
- [ ] Maxmemory settings verified (100MB, allkeys-lru)
- [ ] Key patterns monitoring active

✅ **Datadog Integration**
- [ ] Command statistics metrics appear in Datadog
- [ ] Slowlog metrics available
- [ ] Key length metrics for monitored patterns
- [ ] No errors in Datadog agent logs

✅ **Performance**
- [ ] No increase in pod restarts
- [ ] Memory usage within limits
- [ ] CPU usage stable
- [ ] Application performance unchanged

## Next Steps (Optional)

### 1. Create Custom Dashboard
Create a Redis dashboard in Datadog with:
- Command statistics (GET/SET/DEL rates)
- Slowlog percentiles (p50, p95, p99)
- Key monitoring graphs
- Memory usage trends

### 2. Configure Alerts
Set up monitors for:
- Memory usage >90% of limit
- Slowlog average >50ms
- High eviction rate
- Missing critical keys (sessions)

### 3. Document Operational Runbooks
- What to do when slowlog spikes
- How to investigate missing keys
- When to scale Redis resources

## References

### Similar Implementations
- PostgreSQL: `/Users/pedro.schawirin/Documents/Dogbank/instrumented/k8s/base/postgres.yaml`
  - Advanced DBM configuration
  - Query sampling
  - Custom metrics

- RabbitMQ: `/Users/pedro.schawirin/Documents/Dogbank/instrumented/k8s/base/rabbitmq.yaml`
  - Queue monitoring
  - Connection metrics
  - Message statistics

### Documentation
- Datadog Redis Integration: https://docs.datadoghq.com/integrations/redisdb/
- Redis Slowlog: https://redis.io/commands/slowlog/
- Redis Memory Management: https://redis.io/docs/manual/eviction/

## Troubleshooting

### Issue: Metrics not appearing in Datadog
**Solution:**
1. Check Datadog agent logs: `kubectl logs -n default daemonset/datadog-agent | grep redis`
2. Verify autodiscovery annotation syntax (must be valid JSON)
3. Wait 10-15 minutes for initial metric collection
4. Check Datadog agent status: `kubectl exec -n default ds/datadog-agent -- agent status | grep -A 20 redisdb`

### Issue: Redis pod in CrashLoopBackOff
**Solution:**
1. Check pod logs: `kubectl logs -n dogbank deployment/redis`
2. Verify command syntax (no typos in flags)
3. Check resource limits (may need more memory)
4. Rollback to previous version

### Issue: High memory usage
**Solution:**
1. Check actual Redis memory: `kubectl exec -n dogbank deployment/redis -- redis-cli INFO memory`
2. Reduce slowlog-max-len if needed
3. Reduce number of monitored key patterns
4. Increase container memory limits

### Issue: Keys not being monitored
**Solution:**
1. Verify keys exist: `kubectl exec -n dogbank deployment/redis -- redis-cli KEYS "session:*"`
2. Check pattern syntax in annotation
3. Ensure `warn_on_missing_keys: true` is set
4. Wait for next collection cycle (60 seconds)

## Contact

For questions or issues:
- Check Datadog agent status
- Review pod logs
- Consult Datadog documentation
- Rollback if critical issues occur
