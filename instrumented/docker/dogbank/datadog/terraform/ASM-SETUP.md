# Datadog ASM - Configuration Guide

## Why Attackers Aren't Being Flagged

Datadog ASM has two components:
1. ✅ **Threat Detection** - Working (29.1k traces detected)
2. ❌ **Attacker Flagging** - Not configured (0 IPs flagged)

Detection Rules are needed to automatically flag malicious IPs based on attack patterns.

---

## Quick Setup (Option 1: Datadog UI)

**Time: 5 minutes**

1. Navigate to ASM Rules:
   ```
   https://app.datadoghq.com/security/configuration/asm/rules
   ```

2. Enable these default rules:
   - SQL Injection Detection
   - Remote Code Execution
   - Log4Shell (CVE-2021-44228)
   - Path Traversal

3. Configure IP Blocking Policy:
   ```
   https://app.datadoghq.com/security/configuration/asm/ip-blocking
   ```
   - Create rule: "Block IPs with severity >= HIGH"
   - Duration: 24 hours
   - Action: Block + Log

4. Wait 5 minutes and check:
   ```
   https://app.datadoghq.com/security/appsec/inventory
   ```

---

## Infrastructure as Code Setup (Option 2: Terraform)

**Time: 15 minutes**

### Step 1: Get Datadog App Key

You need both API Key and App Key for Terraform:

```bash
# Já tem o API Key, agora precisa do App Key
# Obtenha em: https://app.datadoghq.com/organization-settings/application-keys
```

### Step 2: Configure Terraform Provider

Uncomment the Datadog provider in `main.tf`:

```hcl
provider "datadog" {
  api_key = var.datadog_api_key
  app_key = var.datadog_app_key
  api_url = "https://api.datadoghq.com/"
}
```

Add variables:

```hcl
variable "datadog_api_key" {
  description = "Datadog API Key"
  type        = string
  sensitive   = true
}

variable "datadog_app_key" {
  description = "Datadog Application Key"
  type        = string
  sensitive   = true
}
```

### Step 3: Set Environment Variables

```bash
export DATADOG_API_KEY="your-api-key"
export DATADOG_APP_KEY="your-app-key"
export TF_VAR_datadog_api_key=$DATADOG_API_KEY
export TF_VAR_datadog_app_key=$DATADOG_APP_KEY
```

### Step 4: Apply Terraform

```bash
cd instrumented/docker/dogbank/datadog/terraform

# Initialize with Datadog provider
terraform init -upgrade

# Plan - review the 8 Detection Rules to be created
terraform plan

# Apply
terraform apply -auto-approve
```

### Step 5: Enable Remote Configuration

Update `datadog-agent-cr.yaml`:

```yaml
spec:
  global:
    remoteConfiguration:
      enabled: true
  features:
    asm:
      threats:
        enabled: true
      iast:
        enabled: true
```

### Step 6: Configure IP Blocking via UI

Terraform creates the Detection Rules, but IP Blocking Policy must be configured via UI:

1. Go to: https://app.datadoghq.com/security/configuration/asm/ip-blocking
2. Create Policy:
   - **Name**: DogBank Auto-Block Attackers
   - **Condition**: Signals with severity >= HIGH
   - **Duration**: 24 hours
   - **Action**: Block + Redirect to /blocked
   - **Scope**: All services

---

## What Each Rule Does

### 1. SQL Injection Detection
- **Trigger**: `@appsec.type:sql_injection`
- **Severity**: High after 3 attempts, Medium after 1
- **Window**: 5 minutes
- **Matches**: `' OR '1'='1`, `UNION SELECT`, etc.

### 2. Remote Code Execution (RCE)
- **Trigger**: `@appsec.type:command_injection`
- **Severity**: Critical on first attempt
- **Window**: 1 minute
- **Matches**: `; cat /etc/passwd`, `| whoami`, etc.

### 3. Log4Shell (CVE-2021-44228)
- **Trigger**: JNDI patterns in requests
- **Severity**: Critical immediately
- **Window**: 1 minute
- **Matches**: `${jndi:ldap://...}`, etc.

### 4. Path Traversal
- **Trigger**: `@appsec.type:path_traversal`
- **Severity**: High after 5 attempts
- **Window**: 5 minutes
- **Matches**: `../../../etc/passwd`, etc.

### 5. Cross-Site Scripting (XSS)
- **Trigger**: `@appsec.type:xss`
- **Severity**: Medium after 3 attempts
- **Window**: 5 minutes
- **Matches**: `<script>alert('XSS')</script>`, etc.

### 6. Authentication Bypass
- **Trigger**: `@appsec.type:authentication_bypass`
- **Severity**: High after 2 attempts
- **Window**: 5 minutes

### 7. IDOR Detection
- **Trigger**: 403 errors on account URLs
- **Severity**: High after 10 attempts
- **Window**: 5 minutes

### 8. Attack Bot Detection
- **Trigger**: User-Agent contains "DogBank-Attacker"
- **Severity**: High immediately
- **Window**: 1 minute

---

## Verification

### Check if Rules are Active

```bash
# Via Datadog API
curl -X GET "https://api.datadoghq.com/api/v2/security_monitoring/rules" \
  -H "DD-API-KEY: ${DATADOG_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DATADOG_APP_KEY}" | jq '.data[] | select(.name | contains("DogBank"))'
```

### Check Flagged IPs

1. Security Signals Dashboard:
   ```
   https://app.datadoghq.com/security?query=@workflow.rule.name%3ADogBank
   ```

2. Flagged Attackers Inventory:
   ```
   https://app.datadoghq.com/security/appsec/inventory
   ```

3. Look for IPs from load-generator pod:
   ```bash
   kubectl get pods -n dogbank -l app=load-generator -o wide
   ```

---

## Expected Results

After configuration, within 5 minutes you should see:

- ✅ **Security Signals**: 8 different rule types triggering
- ✅ **Flagged IPs**: Load generator pod IP flagged with "HIGH" or "CRITICAL"
- ✅ **Attack Timeline**: Graph showing attack patterns over time
- ✅ **Blocked Requests**: If blocking enabled, 403 responses to attacker

---

## Troubleshooting

### Rules Created but No IPs Flagged

1. Check if attacks are still happening:
   ```bash
   kubectl logs -n dogbank -l app=load-generator --tail=50 | grep "Attack"
   ```

2. Verify ASM traces have correct tags:
   ```
   https://app.datadoghq.com/apm/traces?query=service%3Aauth-service+%40appsec.category%3Aattack_attempt
   ```

3. Check Detection Rule queries match your trace attributes

### Remote Configuration Not Working

1. Verify Agent has RC enabled:
   ```bash
   kubectl exec -n dogbank -it datadog-agent-xxxxx -- agent status | grep remote
   ```

2. Check Agent logs:
   ```bash
   kubectl logs -n dogbank -l app=datadog-agent | grep -i "remote config"
   ```

---

## Architecture

```
Load Generator → Auth/Account Services (ASM instrumented)
                          ↓
                   Datadog Agent (collects ASM traces)
                          ↓
                   Datadog Backend
                          ↓
              Detection Rules evaluate traces
                          ↓
              Signal created (HIGH/CRITICAL severity)
                          ↓
              IP Blocking Policy triggers
                          ↓
              IP added to Flagged Attackers
                          ↓
         Remote Config pushes block list to Agent
                          ↓
              Subsequent requests blocked (403)
```

---

## Production Recommendations

1. **Tune thresholds** based on false positive rate
2. **Add notification channels** to Detection Rules (Slack, PagerDuty)
3. **Create separate rules per service** for better visibility
4. **Use IP allowlists** for legitimate security scanners
5. **Set up automated IP unblocking** after investigation
6. **Monitor blocked requests** to ensure no false positives
7. **Create runbook** for security incident response

---

## References

- [Datadog ASM Documentation](https://docs.datadoghq.com/security/application_security/)
- [Detection Rules Reference](https://docs.datadoghq.com/security/detection_rules/)
- [IP Blocking Configuration](https://docs.datadoghq.com/security/application_security/threats/protection/)
