#!/bin/bash
# =============================================================================
# DogBank Load Generator - Entrypoint
# =============================================================================
# Executa o load generator e opcionalmente o security attacker
# =============================================================================

set -e

echo "=========================================="
echo "DogBank Load Generator"
echo "=========================================="

# Verifica qual modo executar
MODE=${RUN_MODE:-"both"}

case $MODE in
    "load")
        echo "Executando apenas Load Generator..."
        python -u load_generator.py
        ;;
    "security")
        echo "Executando apenas Security Attacker..."
        python -u security_attacker.py
        ;;
    "both")
        echo "Executando Load Generator e Security Attacker em paralelo..."
        python -u load_generator.py &
        LOAD_PID=$!

        # Aguarda um pouco antes de iniciar os ataques
        sleep 30

        python -u security_attacker.py &
        SECURITY_PID=$!

        # Aguarda ambos os processos
        wait $LOAD_PID $SECURITY_PID
        ;;
    *)
        echo "Modo desconhecido: $MODE"
        echo "Use: load, security, ou both"
        exit 1
        ;;
esac
