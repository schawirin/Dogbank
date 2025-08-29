#!/bin/bash

# Script para build e push de todas as imagens do DogBank para Docker Hub
# Uso: ./build-and-push-improved.sh [VERSION] [DOCKER_USERNAME]
# Exemplo: ./build-and-push-improved.sh v1.1 schawirin

set -e

# Configurações
VERSION=${1:-v1.1}
DOCKER_USERNAME=${2:-schawirin}
PLATFORM="linux/amd64"
MAX_RETRIES=3
RETRY_DELAY=30

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🐕 DogBank - Build e Push de Imagens para Docker Hub${NC}"
echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}📦 Versão: ${VERSION}${NC}"
echo -e "${BLUE}🏠 Registry: ${DOCKER_USERNAME}${NC}"
echo -e "${BLUE}🖥️  Plataforma: ${PLATFORM}${NC}"

# Verificar se estamos no diretório correto
if [ ! -f "pom.xml" ]; then
    echo -e "${RED}❌ Erro: Execute este script a partir do diretório raiz do projeto (onde está o pom.xml)${NC}"
    echo -e "${BLUE}   Exemplo: cd /caminho/para/dogbank && ./build-and-push-improved.sh${NC}"
    exit 1
fi

# Verificar se os Dockerfiles existem
if [ ! -d "dockerfiles" ]; then
    echo -e "${RED}❌ Erro: Diretório 'dockerfiles' não encontrado!${NC}"
    echo -e "${BLUE}   Certifique-se de que os Dockerfiles estão no diretório 'dockerfiles/'${NC}"
    exit 1
fi

# Verificar se está logado no Docker Hub
echo -e "\n${BLUE}📋 Verificando login no Docker Hub...${NC}"
if ! docker info 2>/dev/null | grep -q "Username: ${DOCKER_USERNAME}"; then
    echo -e "${YELLOW}⚠️  Você não está logado no Docker Hub como ${DOCKER_USERNAME}${NC}"
    echo -e "${BLUE}🔐 Fazendo login...${NC}"
    docker login
fi

# Verificar se buildx está configurado
echo -e "\n${BLUE}🔧 Verificando Docker Buildx...${NC}"
if ! docker buildx version &> /dev/null; then
    echo -e "${RED}❌ Docker Buildx não está instalado${NC}"
    exit 1
fi

# Criar builder se necessário
BUILDER_NAME="dogbank-builder"
if ! docker buildx ls | grep -q "${BUILDER_NAME}"; then
    echo -e "${BLUE}🔨 Criando builder multi-plataforma...${NC}"
    docker buildx create --name ${BUILDER_NAME} --use --driver docker-container
    docker buildx inspect --bootstrap
else
    echo -e "${BLUE}🔨 Usando builder existente: ${BUILDER_NAME}${NC}"
    docker buildx use ${BUILDER_NAME}
fi

# Array com os serviços (ordem de dependências)
declare -a services=(
    "bancocentral:dockerfiles/Dockerfile.bancocentral"
    "account:dockerfiles/Dockerfile.account"
    "auth:dockerfiles/Dockerfile.auth"
    "transaction:dockerfiles/Dockerfile.transaction"
    "integration:dockerfiles/Dockerfile.integration"
    "notification:dockerfiles/Dockerfile.notification"
)

# Função para retry com backoff
retry_with_backoff() {
    local max_attempts=$1
    local delay=$2
    local command="${@:3}"
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        echo -e "${BLUE}🔄 Tentativa ${attempt}/${max_attempts}...${NC}"
        
        if eval "$command"; then
            echo -e "${GREEN}✅ Sucesso na tentativa ${attempt}!${NC}"
            return 0
        else
            if [ $attempt -eq $max_attempts ]; then
                echo -e "${RED}❌ Falhou após ${max_attempts} tentativas${NC}"
                return 1
            fi
            
            echo -e "${YELLOW}⚠️  Tentativa ${attempt} falhou. Aguardando ${delay}s antes da próxima tentativa...${NC}"
            sleep $delay
            
            # Aumentar o delay para a próxima tentativa (backoff exponencial)
            delay=$((delay * 2))
            attempt=$((attempt + 1))
        fi
    done
}

# Compilar todos os módulos primeiro
echo -e "\n${BLUE}🔨 Compilando todos os módulos localmente...${NC}"
mvn clean install -DskipTests

# Build e push de cada serviço
successful_builds=()
failed_builds=()

for service_info in "${services[@]}"; do
    IFS=':' read -r service dockerfile <<< "$service_info"
    
    echo -e "\n${BLUE}🚀 Building e pushing: dogbank-${service}-service${NC}"
    echo -e "${BLUE}================================================${NC}"
    
    # Verificar se o Dockerfile existe
    if [ ! -f "$dockerfile" ]; then
        echo -e "${RED}❌ Dockerfile não encontrado: $dockerfile${NC}"
        echo -e "${BLUE}⏭️  Pulando ${service}...${NC}"
        failed_builds+=("${service} (Dockerfile não encontrado)")
        continue
    fi
    
    # Comando de build e push
    build_command="docker buildx build \\
        --platform ${PLATFORM} \\
        -f ${dockerfile} \\
        -t ${DOCKER_USERNAME}/dogbank-${service}-service:latest \\
        -t ${DOCKER_USERNAME}/dogbank-${service}-service:${VERSION} \\
        --push \\
        --progress=plain \\
        ."
    
    # Tentar build e push com retry
    if retry_with_backoff $MAX_RETRIES $RETRY_DELAY "$build_command"; then
        echo -e "${GREEN}✅ ${service}-service: Build e push concluídos!${NC}"
        successful_builds+=("${service}")
    else
        echo -e "${RED}❌ ${service}-service: Falhou após todas as tentativas${NC}"
        failed_builds+=("${service}")
        
        # Perguntar se quer continuar ou parar
        echo -e "${YELLOW}⚠️  Deseja continuar com os próximos serviços? (y/n)${NC}"
        read -r continue_choice
        if [[ ! $continue_choice =~ ^[Yy]$ ]]; then
            echo -e "${RED}🛑 Build interrompido pelo usuário${NC}"
            break
        fi
    fi
done

# Relatório final
echo -e "\n${BLUE}📊 RELATÓRIO FINAL${NC}"
echo -e "${BLUE}==================${NC}"

if [ ${#successful_builds[@]} -gt 0 ]; then
    echo -e "\n${GREEN}✅ Builds bem-sucedidos (${#successful_builds[@]}):${NC}"
    for service in "${successful_builds[@]}"; do
        echo -e "  • ${DOCKER_USERNAME}/dogbank-${service}-service:${VERSION}"
    done
fi

if [ ${#failed_builds[@]} -gt 0 ]; then
    echo -e "\n${RED}❌ Builds que falharam (${#failed_builds[@]}):${NC}"
    for service in "${failed_builds[@]}"; do
        echo -e "  • ${service}"
    done
    
    echo -e "\n${YELLOW}💡 Para tentar novamente apenas os que falharam, você pode:${NC}"
    echo -e "${BLUE}   1. Verificar sua conexão de internet${NC}"
    echo -e "${BLUE}   2. Tentar fazer logout e login novamente: docker logout && docker login${NC}"
    echo -e "${BLUE}   3. Executar o script novamente${NC}"
    echo -e "${BLUE}   4. Ou fazer o push manual de cada imagem que falhou${NC}"
else
    echo -e "\n${GREEN}🎉 Todas as imagens foram enviadas com sucesso!${NC}"
fi

echo -e "\n${BLUE}💡 Para usar no Kubernetes, atualize os arquivos YAML:${NC}"
echo -e "   image: ${DOCKER_USERNAME}/dogbank-<service>-service:${VERSION}"

# Opcional: limpar o builder (descomente se quiser)
# echo -e "\n${BLUE}🧹 Limpando builder...${NC}"
# docker buildx rm ${BUILDER_NAME}

echo -e "\n${BLUE}✨ Script finalizado!${NC}"

