package com.dogbank.auth.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfigurationSource;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Autowired
    private CorsConfigurationSource corsConfigurationSource;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors().configurationSource(corsConfigurationSource)
            .and()
            .csrf().disable()
            .authorizeHttpRequests((requests) -> requests
                .antMatchers("/**").permitAll() // Libera tudo, sem segurança
            )
            .formLogin().disable() // Remove o login padrão do Spring Security
            .httpBasic().disable(); // Remove a autenticação básica

        return http.build();
    }
}

