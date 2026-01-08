package com.dogbank.auth.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
public class CorsConfig {

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();

        // DESENVOLVIMENTO: Permitir todas as origens usando patterns
        // Para produção, substituir por origens específicas
        configuration.setAllowedOriginPatterns(Arrays.asList("*"));
        
        // Permitir credentials (cookies, authorization headers)
        configuration.setAllowCredentials(true);

        // Métodos permitidos
        configuration.setAllowedMethods(Arrays.asList(
            "GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"
        ));

        // Headers permitidos - todos
        configuration.setAllowedHeaders(Arrays.asList("*"));

        // Headers expostos
        configuration.setExposedHeaders(Arrays.asList(
            "Authorization", "Cache-Control", "Content-Type", 
            "X-Requested-With", "Accept", "Origin"
        ));

        // Tempo de cache para preflight (1 hora)
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
