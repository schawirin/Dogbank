#!/bin/bash

echo "🔧 Aplicando correções de CORS para DogBank..."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Diretório base
BASE_DIR="$(cd "$(dirname "$0")" && pwd)"

echo -e "${YELLOW}📁 Diretório base: $BASE_DIR${NC}"

# Função para criar CorsConfig.java
create_cors_config() {
    local package=$1
    local module=$2
    local file_path="$BASE_DIR/dogbank/$module/src/main/java/com/dogbank/$package/config/CorsConfig.java"
    
    mkdir -p "$(dirname "$file_path")"
    
    cat > "$file_path" << EOF
package com.dogbank.$package.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;

@Configuration
public class CorsConfig {

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(Arrays.asList("*"));
        configuration.setAllowCredentials(true);
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"));
        configuration.setAllowedHeaders(Arrays.asList("*"));
        configuration.setExposedHeaders(Arrays.asList("Authorization", "Cache-Control", "Content-Type", "X-Requested-With", "Accept", "Origin"));
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
EOF
    
    if [ -f "$file_path" ]; then
        echo -e "${GREEN}✅ CorsConfig.java criado para $module${NC}"
    else
        echo -e "${RED}❌ Erro ao criar CorsConfig.java para $module${NC}"
    fi
}

# Aplicar correções em todos os módulos
echo -e "\n${YELLOW}📝 Atualizando CorsConfig.java em todos os módulos...${NC}"

create_cors_config "auth" "auth-module"
create_cors_config "account" "account-module"
create_cors_config "transaction" "transaction-module"
create_cors_config "bancocentral" "bancocentral-module"
create_cors_config "integration" "integration-module"
create_cors_config "notification" "notification-module"

echo -e "\n${GREEN}✅ Todas as correções foram aplicadas!${NC}"
echo -e "\n${YELLOW}📋 Próximos passos:${NC}"
echo "1. Rebuild os containers: docker-compose build --no-cache"
echo "2. Reinicie os serviços: docker-compose up -d"
echo "3. Teste o login: curl -X POST http://localhost/api/auth/login -H 'Content-Type: application/json' -d '{\"cpf\":\"12345678901\",\"password\":\"senha123\"}'"

