package com.dogbank.bancocentral;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Classe principal de inicialização do módulo Banco Central
 * Esta classe serve como ponto de entrada para o Spring Boot
 */
@SpringBootApplication
public class BancoCentralModuleApplication {
    public static void main(String[] args) {
        // Usando a própria classe como ponto de entrada
        SpringApplication.run(BancoCentralModuleApplication.class, args);
    }
}