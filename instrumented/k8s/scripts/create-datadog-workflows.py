#!/usr/bin/env python3
"""
Create Datadog Workflows via API
=================================
Cria workflows de automação no Datadog para ações no cluster EKS.
"""

import os
import json
import requests

# Datadog API credentials
DD_API_KEY = os.getenv("DD_API_KEY", "")
DD_APP_KEY = os.getenv("DD_APP_KEY", "")
DD_SITE = os.getenv("DD_SITE", "datadoghq.com")

# Webhook URL (para demo - usar webhook.site temporariamente)
# Para produção real, deploy o webhook-handler.py e use a URL dele
WEBHOOK_URL = os.getenv("WEBHOOK_URL", "https://webhook.site/unique-uuid")

HEADERS = {
    "DD-API-KEY": DD_API_KEY,
    "DD-APPLICATION-KEY": DD_APP_KEY,
    "Content-Type": "application/json"
}

BASE_URL = f"https://api.{DD_SITE}/api/v2/workflows"


def create_workflow(workflow_data):
    """Create a workflow in Datadog"""
    try:
        response = requests.post(
            BASE_URL,
            headers=HEADERS,
            json=workflow_data
        )

        if response.status_code in [200, 201]:
            result = response.json()
            workflow_id = result.get("data", {}).get("id")
            workflow_name = workflow_data["data"]["attributes"]["name"]
            print(f"✅ Workflow criado: {workflow_name} (ID: {workflow_id})")
            return result
        else:
            print(f"❌ Erro ao criar workflow: {response.status_code}")
            print(f"Response: {response.text}")
            return None

    except Exception as e:
        print(f"❌ Exception: {e}")
        return None


# =============================================================================
# Workflow 1: Restart Pod
# =============================================================================

restart_pod_workflow = {
    "data": {
        "type": "workflows",
        "attributes": {
            "name": "[DogBank] Restart Pod",
            "description": "Reinicia um pod específico do DogBank no cluster EKS",
            "tags": ["env:dogbank", "team:sre", "automation:restart"],
            "spec": {
                "inputs": [
                    {
                        "name": "pod_name",
                        "type": "string",
                        "description": "Nome do pod a ser reiniciado"
                    },
                    {
                        "name": "namespace",
                        "type": "string",
                        "description": "Namespace do pod",
                        "default": "dogbank"
                    }
                ],
                "steps": [
                    {
                        "name": "webhook_call",
                        "actionName": "com.datadoghq.http",
                        "params": {
                            "method": "POST",
                            "url": WEBHOOK_URL,
                            "headers": {
                                "Content-Type": "application/json"
                            },
                            "body": json.dumps({
                                "action": "delete_pod",
                                "pod_name": "{{ inputs.pod_name }}",
                                "namespace": "{{ inputs.namespace }}",
                                "cluster": "eks-sandbox-datadog"
                            })
                        }
                    }
                ]
            }
        }
    }
}

# =============================================================================
# Workflow 2: Rollout Restart All
# =============================================================================

rollout_restart_workflow = {
    "data": {
        "type": "workflows",
        "attributes": {
            "name": "[DogBank] Rollout Restart All Services",
            "description": "Faz rollout restart de todos os serviços do DogBank",
            "tags": ["env:dogbank", "team:sre", "automation:deployment"],
            "spec": {
                "inputs": [
                    {
                        "name": "reason",
                        "type": "string",
                        "description": "Motivo do restart",
                        "default": "Manual restart via Datadog"
                    }
                ],
                "steps": [
                    {
                        "name": "webhook_call",
                        "actionName": "com.datadoghq.http",
                        "params": {
                            "method": "POST",
                            "url": WEBHOOK_URL,
                            "headers": {
                                "Content-Type": "application/json"
                            },
                            "body": json.dumps({
                                "action": "rollout_restart_all",
                                "namespace": "dogbank",
                                "cluster": "eks-sandbox-datadog",
                                "services": [
                                    "account-service",
                                    "transaction-service",
                                    "bancocentral-service",
                                    "chatbot-service",
                                    "frontend",
                                    "nginx"
                                ],
                                "reason": "{{ inputs.reason }}"
                            })
                        }
                    }
                ]
            }
        }
    }
}

# =============================================================================
# Workflow 3: Scale Service
# =============================================================================

scale_service_workflow = {
    "data": {
        "type": "workflows",
        "attributes": {
            "name": "[DogBank] Scale Service",
            "description": "Escala réplicas de um serviço específico",
            "tags": ["env:dogbank", "team:sre", "automation:scaling"],
            "spec": {
                "inputs": [
                    {
                        "name": "service_name",
                        "type": "string",
                        "description": "Nome do serviço (ex: chatbot-service)"
                    },
                    {
                        "name": "replicas",
                        "type": "number",
                        "description": "Número de réplicas desejado"
                    }
                ],
                "steps": [
                    {
                        "name": "webhook_call",
                        "actionName": "com.datadoghq.http",
                        "params": {
                            "method": "POST",
                            "url": WEBHOOK_URL,
                            "headers": {
                                "Content-Type": "application/json"
                            },
                            "body": json.dumps({
                                "action": "scale_deployment",
                                "service": "{{ inputs.service_name }}",
                                "replicas": "{{ inputs.replicas }}",
                                "namespace": "dogbank",
                                "cluster": "eks-sandbox-datadog"
                            })
                        }
                    }
                ]
            }
        }
    }
}

# =============================================================================
# Main
# =============================================================================

if __name__ == "__main__":
    print("=" * 70)
    print("Criando Workflows no Datadog para DogBank")
    print("=" * 70)
    print(f"\nWebhook URL: {WEBHOOK_URL}")
    print(f"Datadog Site: {DD_SITE}\n")

    if "your-webhook-id" in WEBHOOK_URL:
        print("⚠️  ATENÇÃO: Configure a variável WEBHOOK_URL com sua URL real!")
        print("   Para testes, use: https://webhook.site (copia URL única)")
        print("   Para produção, deploy o webhook-handler.py\n")

    # Create workflows
    workflows = [
        ("Restart Pod", restart_pod_workflow),
        ("Rollout Restart All", rollout_restart_workflow),
        ("Scale Service", scale_service_workflow)
    ]

    created = []
    failed = []

    for name, workflow_data in workflows:
        print(f"\n📝 Criando workflow: {name}...")
        result = create_workflow(workflow_data)

        if result:
            created.append(name)
        else:
            failed.append(name)

    # Summary
    print("\n" + "=" * 70)
    print("RESUMO")
    print("=" * 70)
    print(f"✅ Workflows criados: {len(created)}")
    print(f"❌ Workflows falharam: {len(failed)}")

    if created:
        print("\nWorkflows criados:")
        for name in created:
            print(f"  - {name}")

    if failed:
        print("\nWorkflows que falharam:")
        for name in failed:
            print(f"  - {name}")

    print("\n🎯 Próximos passos:")
    print("1. Acesse Datadog → Workflow Automation")
    print("2. Encontre os workflows '[DogBank] ...'")
    print("3. Configure o webhook handler (ver WORKFLOW-SETUP.md)")
    print("4. Teste cada workflow manualmente")
    print("5. (Opcional) Integre com monitores\n")
