# Topology Spread Configuration for Load Balancing

## Problem
Pods are not evenly distributed across the 4 nodes:
- Node 1: 6 pods (overloaded - red in Datadog)
- Node 2: 4 pods
- Node 3: 3 pods
- Node 4: 2 pods

## Solution
Add `topologySpreadConstraints` to deployment specs to ensure even distribution.

## Configuration to Add

Add this to each deployment's `spec.template.spec`:

```yaml
topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: kubernetes.io/hostname
    whenUnsatisfiable: ScheduleAnyway
    labelSelector:
      matchLabels:
        app: <service-name>
```

### Example for auth-service:

```yaml
spec:
  template:
    spec:
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: kubernetes.io/hostname
          whenUnsatisfiable: ScheduleAnyway
          labelSelector:
            matchLabels:
              app: auth-service
      containers:
        - name: auth-service
          # ... rest of config
```

## Parameters Explained

- **maxSkew: 1** - Maximum difference in pod count between nodes
- **topologyKey: kubernetes.io/hostname** - Spread across different nodes
- **whenUnsatisfiable: ScheduleAnyway** - Schedule even if constraint can't be met (soft constraint)
- **labelSelector** - Match pods of the same service

## Apply to These Services

- auth-service
- account-service
- transaction-service
- bancocentral-service
- fraud-detection-service
- notification-service
- frontend

## Alternative: Pod Anti-Affinity

For stateful services, consider pod anti-affinity:

```yaml
affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchExpressions:
              - key: app
                operator: In
                values:
                  - <service-name>
          topologyKey: kubernetes.io/hostname
```

This prevents multiple replicas of the same service on the same node.
