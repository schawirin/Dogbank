package com.dogbank.bancocentral.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalTime;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/bancocentral/pix")
public class PixBancoCentralController {

    @PostMapping("/validate")
    public ResponseEntity<Map<String, Object>> validarPix(@RequestBody Map<String, Object> request) {
        // Extrair valores do request - usar cast seguro
        Double valor = ((Number) request.get("amount")).doubleValue();
        String pixKey = (String) request.get("pixKey");
        
        // Preparar resposta padrão (aprovada)
        Map<String, Object> response = new HashMap<>();
        response.put("pixKey", pixKey);
        response.put("amount", valor);
        response.put("status", "APPROVED");

        // Simulação de erros baseados nas regras definidas
        if (valor == 1000.00) {
            return erroResponse("PIX-LIMITE-EXCEDIDO", "Limite de transação excedido");
        } 
        if (!pixKey.contains("@")) {
            return erroResponse("PIX-CHAVE-INVALIDA", "Chave Pix inválida ou não encontrada");
        } 
        if (valor == 5000.00) {
            return erroResponse("PIX-SALDO-INSUFICIENTE", "Saldo insuficiente para a transação");
        } 
        if (pixKey.equalsIgnoreCase("ex171@gmail.com")) {
            return erroResponse("PIX-CONTA-BLOQUEADA", "Conta bloqueada por suspeita de fraude");
        } 
        // COMENTADO: Validação de horário que estava causando rejeições
        // LocalTime now = LocalTime.now();
        // if (now.isAfter(LocalTime.of(22, 0)) || now.isBefore(LocalTime.of(6, 0))) {
        //     return erroResponse("PIX-HORARIO-NAO-PERMITIDO", "Transação não permitida fora do horário bancário");
        // } 
        if (pixKey.equals("66447697119")) {
            return erroResponse("PIX-CPF-CNPJ-BLOQUEADO", "CPF/CNPJ do destinatário bloqueado pela Receita Federal");
        } 
        if (pixKey.equalsIgnoreCase("containexistente@example.com")) {
            return erroResponse("PIX-DESTINATARIO-INVALIDO", "Conta do destinatário não encontrada");
        } 
        if (valor == 666.66) {
            return erroResponse("PIX-ERRO-INTERNO", "Erro interno do Banco Central");
        }

        // Se chegou aqui, nenhuma condição de erro foi acionada - aprovar a transação
        return ResponseEntity.ok(response);
    }

    private ResponseEntity<Map<String, Object>> erroResponse(String errorCode, String message) {
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("status", "FAILED");
        errorResponse.put("error", message);
        errorResponse.put("errorCode", errorCode);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
    }
}