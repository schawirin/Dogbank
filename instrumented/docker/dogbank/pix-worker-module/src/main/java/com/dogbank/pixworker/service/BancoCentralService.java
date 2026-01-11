package com.dogbank.pixworker.service;

import com.dogbank.pixworker.model.PixTransactionMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@Service
@Slf4j
public class BancoCentralService {

    @Value("${bancocentral.service.url:http://bancocentral-service:8085}")
    private String bancoCentralUrl;

    private final RestTemplate restTemplate;

    public BancoCentralService() {
        this.restTemplate = new RestTemplate();
    }

    /**
     * Validates and processes PIX transaction with Banco Central
     * Returns validation result
     */
    public BancoCentralResponse processTransaction(PixTransactionMessage transaction) {
        log.info("🏦 Sending transaction {} to Banco Central", transaction.getTransactionId());
        
        try {
            String url = bancoCentralUrl + "/api/bancocentral/pix/validate";
            
            Map<String, Object> request = new HashMap<>();
            request.put("transactionId", transaction.getTransactionId());
            request.put("pixKey", transaction.getDestinationPixKey());
            request.put("amount", transaction.getAmount());
            request.put("sourceAccount", transaction.getSourceAccountId());
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            // Add correlation ID for distributed tracing
            headers.set("X-Correlation-ID", transaction.getCorrelationId());
            
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);
            
            ResponseEntity<Map> response = restTemplate.exchange(
                url,
                HttpMethod.POST,
                entity,
                Map.class
            );
            
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> body = response.getBody();
                boolean valid = Boolean.TRUE.equals(body.get("valid"));
                String code = (String) body.getOrDefault("code", "BC000");
                String message = (String) body.getOrDefault("message", "Processed");
                
                log.info("✅ Banco Central response for {}: valid={}, code={}", 
                    transaction.getTransactionId(), valid, code);
                
                return new BancoCentralResponse(valid, code, message);
            }
            
            return new BancoCentralResponse(false, "BC500", "Invalid response from Banco Central");
            
        } catch (RestClientException e) {
            log.error("❌ Error calling Banco Central for transaction {}: {}", 
                transaction.getTransactionId(), e.getMessage());
            
            // Check if it's a timeout (simulated error scenario)
            if (e.getMessage() != null && e.getMessage().contains("timeout")) {
                return new BancoCentralResponse(false, "BC408", "Banco Central timeout");
            }
            
            return new BancoCentralResponse(false, "BC503", "Banco Central unavailable: " + e.getMessage());
        }
    }

    public record BancoCentralResponse(boolean valid, String code, String message) {}
}
