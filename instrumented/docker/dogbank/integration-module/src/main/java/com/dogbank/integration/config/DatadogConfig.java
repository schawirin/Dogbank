package com.dogbank.integration.config;

import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

/**
 * Configuração para integração com Datadog
 */
@Configuration
public class DatadogConfig {

    /**
     * RestTemplate customizado para requisições ao Datadog
     */
    @Bean
    public RestTemplate datadogRestTemplate(RestTemplateBuilder builder) {
        return builder
                .setConnectTimeout(java.time.Duration.ofSeconds(10))
                .setReadTimeout(java.time.Duration.ofSeconds(30))
                .build();
    }
}
