package com.dogbank.chatbot.controller;

import com.dogbank.chatbot.model.ChatRequest;
import com.dogbank.chatbot.model.ChatResponse;
import com.dogbank.chatbot.service.ChatbotService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/chatbot")
@CrossOrigin(origins = "*")
public class ChatbotController {
    
    private static final Logger log = LoggerFactory.getLogger(ChatbotController.class);
    
    @Autowired
    private ChatbotService chatbotService;
    
    /**
     * Endpoint principal do chatbot
     */
    @PostMapping("/message")
    public ResponseEntity<ChatResponse> sendMessage(@RequestBody ChatRequest request) {
        log.info("📨 Recebendo mensagem do usuário {}: {}", request.getUserId(), request.getMessage());
        
        ChatResponse response = chatbotService.processMessage(request);
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * ⚠️ VULNERÁVEL: Endpoint de debug que expõe o system prompt
     * Isso simula um endpoint esquecido em produção
     */
    @GetMapping("/debug/system-prompt")
    public ResponseEntity<Map<String, String>> getSystemPrompt() {
        log.warn("⚠️ [SECURITY] Acesso ao endpoint de debug do system prompt!");
        
        String prompt = chatbotService.getSystemPromptDebug();
        
        return ResponseEntity.ok(Map.of(
            "warning", "Este endpoint não deveria estar exposto em produção!",
            "system_prompt", prompt
        ));
    }
    
    /**
     * Health check
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
            "status", "UP",
            "service", "chatbot-service",
            "version", "1.0.0"
        ));
    }
    
    /**
     * Informações sobre o chatbot
     */
    @GetMapping("/info")
    public ResponseEntity<Map<String, Object>> info() {
        return ResponseEntity.ok(Map.of(
            "name", "DogBot",
            "version", "1.0.0",
            "description", "Assistente virtual do DogBank",
            "capabilities", new String[]{
                "Consultar saldo",
                "Fazer transferências PIX",
                "Ver extrato",
                "Tirar dúvidas"
            },
            "vulnerabilities", Map.of(
                "prompt_injection", true,
                "debug_endpoint_exposed", true,
                "sensitive_data_in_prompt", true
            )
        ));
    }
}
