package com.bacen.spi.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Random;
import java.util.UUID;

/**
 * Controlador que simula a API do SPI (Sistema de Pagamentos Instantâneos)
 * do Banco Central do Brasil.
 * 
 * Este serviço aparece como "spi.bacen.gov.br" no Service Map do Datadog,
 * simulando uma API externa real.
 */
@RestController
@RequestMapping("/api/spi")
public class SpiController {

    private static final Logger log = LoggerFactory.getLogger(SpiController.class);
    private final Random random = new Random();

    /**
     * Endpoint de validação de transação PIX
     * Simula o endpoint real do BACEN: POST /api/v2/pix/validate
     */
    @PostMapping("/validate")
    public ResponseEntity<Map<String, Object>> validatePixTransaction(@RequestBody Map<String, Object> request) {
        String pixKey = (String) request.get("pixKey");
        Double amount = ((Number) request.get("amount")).doubleValue();
        String senderDocument = (String) request.get("senderDocument");
        String requestId = (String) request.get("requestId");
        
        log.info("🏛️ [BACEN-SPI] Recebida solicitação de validação PIX");
        log.info("🏛️ [BACEN-SPI] Request ID: {}, Chave: {}, Valor: R$ {}", requestId, maskPixKey(pixKey), amount);
        
        // Simula latência de rede (50-300ms)
        simulateNetworkLatency();
        
        // Verifica regras de negócio do SPI
        Map<String, Object> response = new HashMap<>();
        String spiTransactionId = generateSpiTransactionId();
        
        // Simula diferentes cenários de resposta
        if (amount == 100.00 || amount == 101.01) {
            // Timeout simulado
            log.warn("⏱️ [BACEN-SPI] Timeout na validação - Valor: R$ {}", amount);
            simulateLongDelay();
            return errorResponse("SPI-TIMEOUT", "Timeout no processamento da transação", HttpStatus.REQUEST_TIMEOUT);
        }
        
        if (amount == 666.66 || amount == 606.66) {
            // Erro interno do SPI
            log.error("❌ [BACEN-SPI] Erro interno do sistema SPI");
            return errorResponse("SPI-INTERNAL-ERROR", "Erro interno do Sistema de Pagamentos Instantâneos", HttpStatus.INTERNAL_SERVER_ERROR);
        }
        
        if (amount > 100000.00) {
            // Valor acima do limite
            log.warn("⚠️ [BACEN-SPI] Valor acima do limite permitido: R$ {}", amount);
            return errorResponse("SPI-LIMIT-EXCEEDED", "Valor excede o limite máximo permitido pelo SPI", HttpStatus.BAD_REQUEST);
        }
        
        // Transação aprovada
        response.put("status", "APPROVED");
        response.put("spiTransactionId", spiTransactionId);
        response.put("message", "Transação validada com sucesso pelo SPI");
        response.put("timestamp", System.currentTimeMillis());
        response.put("processingTimeMs", random.nextInt(100) + 50);
        
        log.info("✅ [BACEN-SPI] Transação aprovada - SPI ID: {}", spiTransactionId);
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * Endpoint de consulta de status de transação
     */
    @GetMapping("/transaction/{spiTransactionId}")
    public ResponseEntity<Map<String, Object>> getTransactionStatus(@PathVariable String spiTransactionId) {
        log.info("🔍 [BACEN-SPI] Consulta de status - SPI ID: {}", spiTransactionId);
        
        simulateNetworkLatency();
        
        Map<String, Object> response = new HashMap<>();
        response.put("spiTransactionId", spiTransactionId);
        response.put("status", "COMPLETED");
        response.put("completedAt", System.currentTimeMillis());
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * Endpoint de health check
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> healthCheck() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "UP");
        response.put("service", "BACEN-SPI");
        response.put("version", "2.0.0");
        response.put("timestamp", System.currentTimeMillis());
        
        return ResponseEntity.ok(response);
    }
    
    private ResponseEntity<Map<String, Object>> errorResponse(String errorCode, String message, HttpStatus status) {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "FAILED");
        response.put("errorCode", errorCode);
        response.put("message", message);
        response.put("timestamp", System.currentTimeMillis());
        
        log.error("🚨 [BACEN-SPI] Erro: {} - {}", errorCode, message);
        
        return ResponseEntity.status(status).body(response);
    }
    
    private void simulateNetworkLatency() {
        try {
            // Simula latência de rede entre 50-300ms
            Thread.sleep(50 + random.nextInt(250));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
    
    private void simulateLongDelay() {
        try {
            // Simula timeout de 5 segundos
            Thread.sleep(5000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
    
    private String generateSpiTransactionId() {
        return "SPI-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }
    
    private String maskPixKey(String pixKey) {
        if (pixKey == null || pixKey.length() < 4) return "****";
        return pixKey.substring(0, 3) + "***" + pixKey.substring(pixKey.length() - 3);
    }
}
