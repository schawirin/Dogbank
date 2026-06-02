#!/usr/bin/env python3
"""
DogBank Webhook Handler for Datadog Workflows
==============================================
Recebe webhooks do Datadog e executa ações no cluster EKS.

Deploy options:
1. AWS Lambda + API Gateway
2. Simple Flask server
3. Cloud Run / Cloud Functions

Endpoints:
- POST /webhook - Recebe actions do Datadog
"""

import os
import json
import subprocess
import logging
from datetime import datetime
from flask import Flask, request, jsonify

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# =============================================================================
# Configuration
# =============================================================================

EKS_CLUSTER = os.getenv("EKS_CLUSTER", "eks-sandbox-datadog")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "")  # Para validar requests

# =============================================================================
# Helper Functions
# =============================================================================

def run_kubectl_command(cmd: list) -> dict:
    """Execute kubectl command and return result"""
    try:
        logger.info(f"Executing: {' '.join(cmd)}")

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60
        )

        return {
            "success": result.returncode == 0,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode
        }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "error": "Command timeout (60s)"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


def validate_webhook_secret(request_secret: str) -> bool:
    """Validate webhook secret for security"""
    if not WEBHOOK_SECRET:
        logger.warning("⚠️ WEBHOOK_SECRET not set! Accepting all requests (insecure)")
        return True

    return request_secret == WEBHOOK_SECRET


# =============================================================================
# Actions
# =============================================================================

def delete_pod(pod_name: str, namespace: str = "dogbank") -> dict:
    """Delete a pod (Kubernetes will recreate it)"""
    cmd = [
        "kubectl", "delete", "pod", pod_name,
        "-n", namespace,
        "--grace-period=0",
        "--force"
    ]

    result = run_kubectl_command(cmd)

    return {
        "action": "delete_pod",
        "pod_name": pod_name,
        "namespace": namespace,
        "success": result["success"],
        "message": f"Pod {pod_name} deleted. Kubernetes will create a new one.",
        "details": result
    }


def rollout_restart_all(namespace: str = "dogbank", services: list = None) -> dict:
    """Rollout restart all deployments"""
    if not services:
        services = [
            "account-service",
            "auth-service",
            "transaction-service",
            "bancocentral-service",
            "chatbot-service",
            "frontend",
            "nginx"
        ]

    results = []

    for service in services:
        cmd = [
            "kubectl", "rollout", "restart",
            f"deployment/{service}",
            "-n", namespace
        ]

        result = run_kubectl_command(cmd)
        results.append({
            "service": service,
            "success": result["success"],
            "output": result["stdout"]
        })

    all_success = all(r["success"] for r in results)

    return {
        "action": "rollout_restart_all",
        "namespace": namespace,
        "services_count": len(services),
        "success": all_success,
        "message": f"Rollout restart initiated for {len(services)} services",
        "details": results
    }


def scale_deployment(service: str, replicas: int, namespace: str = "dogbank") -> dict:
    """Scale a deployment to N replicas"""
    cmd = [
        "kubectl", "scale",
        f"deployment/{service}",
        f"--replicas={replicas}",
        "-n", namespace
    ]

    result = run_kubectl_command(cmd)

    return {
        "action": "scale_deployment",
        "service": service,
        "namespace": namespace,
        "replicas": replicas,
        "success": result["success"],
        "message": f"Service {service} scaled to {replicas} replicas",
        "details": result
    }


def rollback_deployment(service: str, namespace: str = "dogbank") -> dict:
    """Rollback deployment to previous version"""
    cmd = [
        "kubectl", "rollout", "undo",
        f"deployment/{service}",
        "-n", namespace
    ]

    result = run_kubectl_command(cmd)

    return {
        "action": "rollback_deployment",
        "service": service,
        "namespace": namespace,
        "success": result["success"],
        "message": f"Service {service} rolled back to previous version",
        "details": result
    }


def get_pod_status(namespace: str = "dogbank") -> dict:
    """Get all pod statuses"""
    cmd = [
        "kubectl", "get", "pods",
        "-n", namespace,
        "-o", "json"
    ]

    result = run_kubectl_command(cmd)

    if result["success"]:
        pods_data = json.loads(result["stdout"])

        pods = []
        for pod in pods_data.get("items", []):
            pods.append({
                "name": pod["metadata"]["name"],
                "status": pod["status"]["phase"],
                "ready": pod["status"].get("containerStatuses", [{}])[0].get("ready", False),
                "restarts": pod["status"].get("containerStatuses", [{}])[0].get("restartCount", 0),
            })

        return {
            "action": "get_pod_status",
            "namespace": namespace,
            "success": True,
            "pods_count": len(pods),
            "pods": pods
        }

    return {
        "action": "get_pod_status",
        "namespace": namespace,
        "success": False,
        "error": result["stderr"]
    }


# =============================================================================
# Flask Routes
# =============================================================================

@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "dogbank-webhook-handler",
        "timestamp": datetime.utcnow().isoformat()
    })


@app.route("/webhook", methods=["POST"])
def webhook():
    """Main webhook endpoint for Datadog Workflows"""
    try:
        # Validate secret
        secret = request.headers.get("X-Webhook-Secret", "")
        if not validate_webhook_secret(secret):
            logger.warning("⚠️ Invalid webhook secret")
            return jsonify({"error": "Unauthorized"}), 401

        # Parse request
        data = request.json
        action = data.get("action")

        logger.info(f"📥 Received action: {action}")
        logger.info(f"📋 Payload: {json.dumps(data, indent=2)}")

        # Execute action
        if action == "delete_pod":
            result = delete_pod(
                pod_name=data.get("pod_name"),
                namespace=data.get("namespace", "dogbank")
            )

        elif action == "rollout_restart_all":
            result = rollout_restart_all(
                namespace=data.get("namespace", "dogbank"),
                services=data.get("services")
            )

        elif action == "scale_deployment":
            result = scale_deployment(
                service=data.get("service"),
                replicas=data.get("replicas"),
                namespace=data.get("namespace", "dogbank")
            )

        elif action == "rollback_deployment":
            result = rollback_deployment(
                service=data.get("service"),
                namespace=data.get("namespace", "dogbank")
            )

        elif action == "get_pod_status":
            result = get_pod_status(
                namespace=data.get("namespace", "dogbank")
            )

        else:
            result = {
                "success": False,
                "error": f"Unknown action: {action}"
            }

        # Log result
        if result["success"]:
            logger.info(f"✅ Action completed: {action}")
        else:
            logger.error(f"❌ Action failed: {action}")

        status_code = 200 if result["success"] else 500
        return jsonify(result), status_code

    except Exception as e:
        logger.error(f"❌ Webhook error: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# =============================================================================
# Run Server
# =============================================================================

if __name__ == "__main__":
    # Configure kubectl for EKS
    logger.info(f"🔧 Configuring kubectl for EKS cluster: {EKS_CLUSTER}")

    config_result = run_kubectl_command([
        "aws", "eks", "update-kubeconfig",
        "--region", AWS_REGION,
        "--name", EKS_CLUSTER
    ])

    if config_result["success"]:
        logger.info("✅ kubectl configured successfully")
    else:
        logger.error(f"❌ Failed to configure kubectl: {config_result}")

    # Run Flask server
    port = int(os.getenv("PORT", 8080))
    logger.info(f"🚀 Starting webhook handler on port {port}")

    app.run(host="0.0.0.0", port=port, debug=False)
