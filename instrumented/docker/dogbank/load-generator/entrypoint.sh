#!/bin/bash
# =============================================================================
# DogBank Load Generator - Entrypoint
# =============================================================================
# Executa o load generator, security attacker e/ou chatbot tester
#
# Modos disponiveis:
#   - load:     Apenas transacoes PIX
#   - security: Apenas ataques de seguranca (ASM/IAST)
#   - chatbot:  Apenas testes de chatbot (LLM Observability)
#   - both:     Load + Security (padrao)
#   - all:      Load + Security + Chatbot
# =============================================================================

set -e

echo "=========================================="
echo "DogBank Load Generator"
echo "=========================================="

# Verifica qual modo executar
MODE=${RUN_MODE:-"both"}
echo "Modo: $MODE"

case $MODE in
    "load")
        echo "Executando apenas Load Generator..."
        python -u load_generator.py
        ;;
    "security")
        echo "Executando apenas Security Attacker..."
        python -u security_attacker.py
        ;;
    "chatbot")
        echo "Executando apenas Chatbot Tester..."
        python -u chatbot_tester.py
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
    "all")
        echo "Executando Load Generator, Security Attacker e Chatbot Tester..."

        # Inicia Load Generator
        python -u load_generator.py &
        LOAD_PID=$!
        echo "Load Generator iniciado (PID: $LOAD_PID)"

        # Aguarda antes de iniciar Security Attacker
        sleep 20

        # Inicia Security Attacker
        python -u security_attacker.py &
        SECURITY_PID=$!
        echo "Security Attacker iniciado (PID: $SECURITY_PID)"

        # Aguarda antes de iniciar Chatbot Tester
        sleep 10

        # Inicia Chatbot Tester
        python -u chatbot_tester.py &
        CHATBOT_PID=$!
        echo "Chatbot Tester iniciado (PID: $CHATBOT_PID)"

        # Aguarda todos os processos
        wait $LOAD_PID $SECURITY_PID $CHATBOT_PID
        ;;
    *)
        echo "Modo desconhecido: $MODE"
        echo "Use: load, security, chatbot, both, ou all"
        exit 1
        ;;
esac
