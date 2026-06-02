package com.dogbank.bancocentral.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;
import java.util.Random;

/**
 * Serviço que simula a comunicação com o SPI (Sistema de Pagamentos Instantâneos)
 * do Banco Central do Brasil.
 * 
 * Esta é uma API externa simulada que aparece no Service Map do Datadog.
 */
@Service
public class SpiExternalService {

    private static final Logger log = LoggerFactory.getLogger(SpiExternalService.class);
    
    private final RestTemplate restTemplate;
    private final Random random = new Random();
    
    @Value("${spi.api.url:http://spi-mock-service:8090}")
    private String spiApiUrl;

    @Value("${spi.fallback.approve:false}")
    private boolean approveFallback;
    
    public SpiExternalService() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(4000); // SPI mock dorme 5s para R$100 → timeout real
        this.restTemplate = new RestTemplate(factory);
    }
    
    /**
     * Valida uma transação PIX com o SPI do Banco Central
     */
    public SpiValidationResult validatePixTransaction(String pixKey, Double amount, String senderCpf) {
        log.info("📡 [SPI] Iniciando validação com Sistema de Pagamentos Instantâneos");
        log.info("📡 [SPI] URL: {}/api/spi/validate", spiApiUrl);
        
        try {
            // Prepara o request para o SPI
            Map<String, Object> spiRequest = new HashMap<>();
            spiRequest.put("pixKey", pixKey);
            spiRequest.put("amount", amount);
            spiRequest.put("senderDocument", senderCpf);
            spiRequest.put("timestamp", System.currentTimeMillis());
            spiRequest.put("requestId", generateRequestId());
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("X-SPI-Version", "2.0");
            headers.set("X-SPI-Auth", "Bearer spi-token-" + System.currentTimeMillis());
            
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(spiRequest, headers);
            
            // Chama a API externa do SPI
            ResponseEntity<Map> response = restTemplate.postForEntity(
                spiApiUrl + "/api/spi/validate",
                entity,
                Map.class
            );
            
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> body = response.getBody();
                String status = (String) body.get("status");
                String spiTransactionId = (String) body.get("spiTransactionId");
                
                log.info("✅ [SPI] Resposta recebida - Status: {}, SPI ID: {}", status, spiTransactionId);
                
                return new SpiValidationResult(
                    "APPROVED".equals(status),
                    spiTransactionId,
                    (String) body.get("message"),
                    (String) body.get("errorCode")
                );
            }
            
            log.warn("⚠️ [SPI] Resposta inesperada do SPI");
            return new SpiValidationResult(false, null, "Resposta inesperada do SPI", "SPI-UNEXPECTED");
            
        } catch (ResourceAccessException e) {
            if (e.getCause() instanceof java.net.SocketTimeoutException) {
                log.error("⏱️ [SPI] SocketTimeoutException: SPI do Banco Central nao respondeu no prazo (4s): {}", e.getMessage(), e);
                return new SpiValidationResult(false, null,
                    "SPI indisponivel: timeout na conexao com o Banco Central",
                    "SPI-TIMEOUT");
            }
            log.error("❌ [SPI] Erro de conexao com SPI: {}", e.getMessage(), e);
            if (approveFallback) {
                return simulateLocalValidation(pixKey, amount);
            }
            return new SpiValidationResult(false, null,
                "SPI indisponivel: " + e.getMessage(),
                "SPI-COMMUNICATION-ERROR");
        } catch (Exception e) {
            log.error("❌ [SPI] Erro inesperado ao comunicar com SPI: {}", e.getMessage(), e);
            if (approveFallback) {
                return simulateLocalValidation(pixKey, amount);
            }
            return new SpiValidationResult(false, null,
                "SPI indisponivel ou rejeitou a transacao: " + e.getMessage(),
                "SPI-COMMUNICATION-ERROR");
        }
    }
    
    /**
     * Simula validação local quando o SPI não está disponível
     */
    private SpiValidationResult simulateLocalValidation(String pixKey, Double amount) {
        log.info("🔄 [SPI-FALLBACK] Usando validação local (SPI indisponível)");
        
        // Simula delay de processamento
        try {
            Thread.sleep(100 + random.nextInt(200));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        // Gera um ID de transação simulado
        String spiTransactionId = "SPI-" + System.currentTimeMillis() + "-" + random.nextInt(9999);
        
        return new SpiValidationResult(true, spiTransactionId, "Validação local aprovada", null);
    }
    
    private String generateRequestId() {
        return "REQ-" + System.currentTimeMillis() + "-" + random.nextInt(9999);
    }
    
    /**
     * Resultado da validação com o SPI
     */
    public static class SpiValidationResult {
        private final boolean approved;
        private final String spiTransactionId;
        private final String message;
        private final String errorCode;
        
        public SpiValidationResult(boolean approved, String spiTransactionId, String message, String errorCode) {
            this.approved = approved;
            this.spiTransactionId = spiTransactionId;
            this.message = message;
            this.errorCode = errorCode;
        }
        
        public boolean isApproved() { return approved; }
        public String getSpiTransactionId() { return spiTransactionId; }
        public String getMessage() { return message; }
        public String getErrorCode() { return errorCode; }
    }
}
