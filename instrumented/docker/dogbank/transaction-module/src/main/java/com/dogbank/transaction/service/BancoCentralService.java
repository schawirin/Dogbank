package com.dogbank.transaction.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.*;

import java.util.HashMap;
import java.util.Map;

@Service
public class BancoCentralService {

    @Value("${bancocentral.api.url}")
    private String bancoCentralApiUrl;

    private final RestTemplate restTemplate;

    public BancoCentralService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public boolean validarPix(String pixKey, double amount) {
        // Monta o request para o Banco Central
        Map<String, Object> request = new HashMap<>();
        request.put("pixKey", pixKey);
        request.put("amount", amount);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                bancoCentralApiUrl,
                HttpMethod.POST,
                entity,
                Map.class
            );

            // Verifica se o status retornado foi aprovado
            return "APPROVED".equals(response.getBody().get("status"));
        } catch (Exception e) {
            System.err.println("Erro ao validar Pix com Banco Central: " + e.getMessage());
            return false;
        }
    }
}
