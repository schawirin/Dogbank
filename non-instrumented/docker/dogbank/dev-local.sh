#!/bin/bash

# Script para desenvolvimento local com Docker Compose

set -e

echo "🐕 DogBank - Desenvolvimento Local com Microserviços"
echo "=================================================="

# Função para mostrar ajuda
show_help() {
    echo "Uso: $0 [COMANDO]"
    echo ""
    echo "Comandos disponíveis:"
    echo "  start     - Inicia todos os serviços"
    echo "  stop      - Para todos os serviços"
    echo "  restart   - Reinicia todos os serviços"
    echo "  build     - Reconstrói as imagens"
    echo "  logs      - Mostra logs de todos os serviços"
    echo "  status    - Mostra status dos serviços"
    echo "  clean     - Remove containers, volumes e imagens"
    echo "  help      - Mostra esta ajuda"
    echo ""
    echo "Exemplos:"
    echo "  $0 start"
    echo "  $0 logs transaction-service"
    echo "  $0 build auth-service"
}

# Função para verificar se Docker está rodando
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo "❌ Docker não está rodando. Por favor, inicie o Docker primeiro."
        exit 1
    fi
}

# Função para iniciar serviços
start_services() {
    echo "🚀 Iniciando serviços DogBank..."
    docker-compose -f docker-compose.microservices.yml up -d
    echo ""
    echo "✅ Serviços iniciados!"
    echo ""
    echo "🌐 Endpoints disponíveis:"
    echo "  - API Gateway: http://localhost"
    echo "  - Auth Service: http://localhost:8088"
    echo "  - Account Service: http://localhost:8089"
    echo "  - Transaction Service: http://localhost:8084"
    echo "  - BancoCentral Service: http://localhost:8085"
    echo "  - Integration Service: http://localhost:8082"
    echo "  - Notification Service: http://localhost:8083"
    echo "  - PostgreSQL: localhost:5432"
    echo ""
    echo "📊 Para ver logs: $0 logs"
    echo "🔍 Para ver status: $0 status"
}

# Função para parar serviços
stop_services() {
    echo "🛑 Parando serviços DogBank..."
    docker-compose -f docker-compose.microservices.yml down
    echo "✅ Serviços parados!"
}

# Função para reiniciar serviços
restart_services() {
    echo "🔄 Reiniciando serviços DogBank..."
    docker-compose -f docker-compose.microservices.yml restart
    echo "✅ Serviços reiniciados!"
}

# Função para rebuild
build_services() {
    echo "🔨 Reconstruindo imagens..."
    docker-compose -f docker-compose.microservices.yml build --no-cache
    echo "✅ Imagens reconstruídas!"
}

# Função para mostrar logs
show_logs() {
    if [ -n "$2" ]; then
        docker-compose -f docker-compose.microservices.yml logs -f "$2"
    else
        docker-compose -f docker-compose.microservices.yml logs -f
    fi
}

# Função para mostrar status
show_status() {
    echo "📊 Status dos serviços DogBank:"
    docker-compose -f docker-compose.microservices.yml ps
}

# Função para limpeza completa
clean_all() {
    echo "🧹 Limpando ambiente DogBank..."
    docker-compose -f docker-compose.microservices.yml down -v --rmi all
    docker system prune -f
    echo "✅ Ambiente limpo!"
}

# Verificar Docker
check_docker

# Processar comando
case "${1:-help}" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    build)
        build_services
        ;;
    logs)
        show_logs "$@"
        ;;
    status)
        show_status
        ;;
    clean)
        clean_all
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "❌ Comando inválido: $1"
        echo ""
        show_help
        exit 1
        ;;
esac

