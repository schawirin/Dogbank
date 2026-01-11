package com.dogbank.bancocentral.controller;

import com.dogbank.bancocentral.service.SpiExternalService;
import com.dogbank.bancocentral.service.SpiExternalService.SpiValidationResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalTime;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/bancocentral/pix")
public class PixBancoCentralController {

    private static final Logger log = LoggerFactory.getLogger(PixBancoCentralController.class);
    
    @Autowired
    private SpiExternalService spiExternalService;

    @PostMapping("/validate")
    public ResponseEntity<Map<String, Object>> validarPix(@RequestBody Map<String, Object> request) {
        // Extrair valores do request
        Double valor = ((Number) request.get("amount")).doubleValue();
        String pixKey = (String) request.get("pixKey");
        
        log.info("🔍 [BANCO CENTRAL] Validando PIX - Chave: {}, Valor: R$ {}", pixKey, valor);

        // SIMULAÇÃO DE TIMEOUT - 100 reais
        if (valor == 100.00) {
            log.error("⏱️ [TIMEOUT] Simulação de timeout do Banco Central - Valor: R$ {}", valor);
            try {
                // Simula delay antes de falhar
                Thread.sleep(5000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            return erroResponse("PIX-TIMEOUT", "Timeout ao conectar com Banco Central", HttpStatus.REQUEST_TIMEOUT);
        }

        // Simulação de erros baseados nas regras definidas
        if (valor == 1000.00) {
            log.error("❌ [ERRO] Limite excedido - Valor: R$ {}", valor);
            return erroResponse("PIX-LIMITE-EXCEDIDO", "Limite de transação excedido", HttpStatus.BAD_REQUEST);
        }
        
        if (!pixKey.contains("@")) {
            log.error("❌ [ERRO] Chave PIX inválida - Chave: {}", pixKey);
            return erroResponse("PIX-CHAVE-INVALIDA", "Chave Pix inválida ou não encontrada", HttpStatus.BAD_REQUEST);
        }
        
        if (valor == 5000.00) {
            log.error("❌ [ERRO] Saldo insuficiente - Valor: R$ {}", valor);
            return erroResponse("PIX-SALDO-INSUFICIENTE", "Saldo insuficiente para a transação", HttpStatus.BAD_REQUEST);
        }
        
        if (pixKey.equalsIgnoreCase("ex171@gmail.com")) {
            log.error("❌ [ERRO] Conta bloqueada - Chave: {}", pixKey);
            return erroResponse("PIX-CONTA-BLOQUEADA", "Conta bloqueada por suspeita de fraude", HttpStatus.FORBIDDEN);
        }
        
        if (pixKey.equals("66447697119")) {
            log.error("❌ [ERRO] CPF bloqueado - CPF: {}", pixKey);
            return erroResponse("PIX-CPF-CNPJ-BLOQUEADO", "CPF/CNPJ bloqueado pela Receita Federal", HttpStatus.FORBIDDEN);
        }
        
        if (pixKey.equalsIgnoreCase("containexistente@example.com")) {
            log.error("❌ [ERRO] Destinatário não encontrado - Chave: {}", pixKey);
            return erroResponse("PIX-DESTINATARIO-INVALIDO", "Conta do destinatário não encontrada", HttpStatus.NOT_FOUND);
        }
        
        if (valor == 666.66) {
            log.error("❌ [ERRO] Erro interno do Banco Central - Valor: R$ {}", valor);
            return erroResponse("PIX-ERRO-INTERNO", "Erro interno do Banco Central", HttpStatus.INTERNAL_SERVER_ERROR);
        }

        // Chama o SPI (Sistema de Pagamentos Instantâneos) do Banco Central
        log.info("📡 [BANCO CENTRAL] Consultando SPI para validação final...");
        String senderCpf = (String) request.getOrDefault("senderCpf", "00000000000");
        SpiValidationResult spiResult = spiExternalService.validatePixTransaction(pixKey, valor, senderCpf);
        
        if (!spiResult.isApproved()) {
            log.error("❌ [SPI] Transação rejeitada pelo SPI: {}", spiResult.getMessage());
            return erroResponse(spiResult.getErrorCode(), spiResult.getMessage(), HttpStatus.BAD_REQUEST);
        }
        
        // Transação aprovada
        Map<String, Object> response = new HashMap<>();
        response.put("pixKey", pixKey);
        response.put("amount", valor);
        response.put("status", "APPROVED");
        response.put("spiTransactionId", spiResult.getSpiTransactionId());
        
        log.info("✅ [SUCESSO] PIX aprovado - Chave: {}, Valor: R$ {}, SPI ID: {}", pixKey, valor, spiResult.getSpiTransactionId());
        
        return ResponseEntity.ok(response);
    }

    private ResponseEntity<Map<String, Object>> erroResponse(String errorCode, String message, HttpStatus status) {
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("status", "FAILED");
        errorResponse.put("error", message);
        errorResponse.put("errorCode", errorCode);
        
        // Log adicional para trace
        log.error("🚨 [BANCO CENTRAL ERROR] Code: {}, Message: {}, HTTP Status: {}", 
                  errorCode, message, status.value());
        
        return ResponseEntity.status(status).body(errorResponse);
    }
}