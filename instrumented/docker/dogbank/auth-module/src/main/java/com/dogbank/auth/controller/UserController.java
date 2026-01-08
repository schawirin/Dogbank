package com.dogbank.auth.controller;

import com.dogbank.auth.entity.User;
import com.dogbank.auth.service.UserService;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Controller responsável pelos endpoints relacionados aos usuários
 * Porta: 8088
 */
@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = "*")
public class UserController {

    private static final Logger logger = LogManager.getLogger(UserController.class);

    @Autowired
    private UserService userService;

    /**
     * Busca usuário por ID
     * GET /api/users/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getUserById(@PathVariable Long id) {
        long startTime = System.currentTimeMillis();
        
        Map<String, Object> logData = new HashMap<>();
        logData.put("endpoint", "GET /api/users/{id}");
        logData.put("userId", id);
        logData.put("timestamp", System.currentTimeMillis());
        
        logger.info("Iniciando busca de usuário por ID: {}", logData);

        try {
            Optional<User> user = userService.findById(id);
            
            if (user.isPresent()) {
                User userData = user.get();
                // Remove senha antes de retornar
                userData.setSenha(null);
                
                logData.put("status", "success");
                logData.put("duration_ms", System.currentTimeMillis() - startTime);
                logger.info("Usuário encontrado: {}", logData);
                
                return ResponseEntity.ok(userData);
            } else {
                logData.put("status", "not_found");
                logData.put("duration_ms", System.currentTimeMillis() - startTime);
                logger.warn("Usuário não encontrado: {}", logData);
                
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Usuário não encontrado", "userId", id));
            }
        } catch (Exception e) {
            logData.put("status", "error");
            logData.put("error_message", e.getMessage());
            logData.put("duration_ms", System.currentTimeMillis() - startTime);
            logger.error("Erro ao buscar usuário: {}", logData, e);
            
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Erro ao buscar usuário", "message", e.getMessage()));
        }
    }

    /**
     * Busca usuário por chave PIX - ENDPOINT CRÍTICO PARA TRANSAÇÕES
     * GET /api/users/pix/{pixKey}
     */
    @GetMapping("/pix/{pixKey}")
    public ResponseEntity<?> getUserByPixKey(@PathVariable String pixKey) {
        long startTime = System.currentTimeMillis();
        
        Map<String, Object> logData = new HashMap<>();
        logData.put("endpoint", "GET /api/users/pix/{pixKey}");
        logData.put("pixKey", pixKey);
        logData.put("timestamp", System.currentTimeMillis());
        
        logger.info("Iniciando busca de usuário por chave PIX: {}", logData);

        try {
            Optional<User> user = userService.findByChavePix(pixKey);
            
            if (user.isPresent()) {
                User userData = user.get();
                // Remove senha antes de retornar
                userData.setSenha(null);
                
                logData.put("status", "success");
                logData.put("userId", userData.getId());
                logData.put("duration_ms", System.currentTimeMillis() - startTime);
                logger.info("Usuário encontrado por chave PIX: {}", logData);
                
                return ResponseEntity.ok(userData);
            } else {
                logData.put("status", "not_found");
                logData.put("duration_ms", System.currentTimeMillis() - startTime);
                logger.warn("Usuário não encontrado para chave PIX: {}", logData);
                
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Chave PIX não encontrada", "pixKey", pixKey));
            }
        } catch (Exception e) {
            logData.put("status", "error");
            logData.put("error_message", e.getMessage());
            logData.put("duration_ms", System.currentTimeMillis() - startTime);
            logger.error("Erro ao buscar usuário por chave PIX: {}", logData, e);
            
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Erro ao buscar usuário por chave PIX", "message", e.getMessage()));
        }
    }

    /**
     * Busca usuário por CPF
     * GET /api/users/cpf/{cpf}
     */
    @GetMapping("/cpf/{cpf}")
    public ResponseEntity<?> getUserByCpf(@PathVariable String cpf) {
        long startTime = System.currentTimeMillis();
        
        Map<String, Object> logData = new HashMap<>();
        logData.put("endpoint", "GET /api/users/cpf/{cpf}");
        logData.put("cpf", cpf);
        logData.put("timestamp", System.currentTimeMillis());
        
        logger.info("Iniciando busca de usuário por CPF: {}", logData);

        try {
            Optional<User> user = userService.findByCpf(cpf);
            
            if (user.isPresent()) {
                User userData = user.get();
                // Remove senha antes de retornar
                userData.setSenha(null);
                
                logData.put("status", "success");
                logData.put("userId", userData.getId());
                logData.put("duration_ms", System.currentTimeMillis() - startTime);
                logger.info("Usuário encontrado por CPF: {}", logData);
                
                return ResponseEntity.ok(userData);
            } else {
                logData.put("status", "not_found");
                logData.put("duration_ms", System.currentTimeMillis() - startTime);
                logger.warn("Usuário não encontrado para CPF: {}", logData);
                
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "CPF não encontrado", "cpf", cpf));
            }
        } catch (Exception e) {
            logData.put("status", "error");
            logData.put("error_message", e.getMessage());
            logData.put("duration_ms", System.currentTimeMillis() - startTime);
            logger.error("Erro ao buscar usuário por CPF: {}", logData, e);
            
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Erro ao buscar usuário por CPF", "message", e.getMessage()));
        }
    }

    /**
     * Busca usuário por email
     * GET /api/users/email/{email}
     */
    @GetMapping("/email/{email}")
    public ResponseEntity<?> getUserByEmail(@PathVariable String email) {
        long startTime = System.currentTimeMillis();
        
        Map<String, Object> logData = new HashMap<>();
        logData.put("endpoint", "GET /api/users/email/{email}");
        logData.put("email", email);
        logData.put("timestamp", System.currentTimeMillis());
        
        logger.info("Iniciando busca de usuário por email: {}", logData);

        try {
            Optional<User> user = userService.findByEmail(email);
            
            if (user.isPresent()) {
                User userData = user.get();
                // Remove senha antes de retornar
                userData.setSenha(null);
                
                logData.put("status", "success");
                logData.put("userId", userData.getId());
                logData.put("duration_ms", System.currentTimeMillis() - startTime);
                logger.info("Usuário encontrado por email: {}", logData);
                
                return ResponseEntity.ok(userData);
            } else {
                logData.put("status", "not_found");
                logData.put("duration_ms", System.currentTimeMillis() - startTime);
                logger.warn("Usuário não encontrado para email: {}", logData);
                
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Email não encontrado", "email", email));
            }
        } catch (Exception e) {
            logData.put("status", "error");
            logData.put("error_message", e.getMessage());
            logData.put("duration_ms", System.currentTimeMillis() - startTime);
            logger.error("Erro ao buscar usuário por email: {}", logData, e);
            
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Erro ao buscar usuário por email", "message", e.getMessage()));
        }
    }

    /**
     * Valida senha do usuário - usado para autenticação em transações
     * POST /api/users/{id}/validate-password
     */
    @PostMapping("/{id}/validate-password")
    public ResponseEntity<?> validatePassword(@PathVariable Long id, @RequestBody Map<String, String> request) {
        long startTime = System.currentTimeMillis();
        
        Map<String, Object> logData = new HashMap<>();
        logData.put("endpoint", "POST /api/users/{id}/validate-password");
        logData.put("userId", id);
        logData.put("timestamp", System.currentTimeMillis());
        
        logger.info("Iniciando validação de senha: {}", logData);

        try {
            String password = request.get("senha");
            
            if (password == null || password.isEmpty()) {
                logData.put("status", "invalid_request");
                logData.put("duration_ms", System.currentTimeMillis() - startTime);
                logger.warn("Senha não fornecida: {}", logData);
                
                return ResponseEntity.badRequest()
                    .body(Map.of("error", "Senha é obrigatória"));
            }

            boolean isValid = userService.validatePassword(id, password);
            
            logData.put("status", isValid ? "success" : "invalid_password");
            logData.put("isValid", isValid);
            logData.put("duration_ms", System.currentTimeMillis() - startTime);
            logger.info("Validação de senha concluída: {}", logData);
            
            return ResponseEntity.ok(Map.of("valid", isValid));
            
        } catch (Exception e) {
            logData.put("status", "error");
            logData.put("error_message", e.getMessage());
            logData.put("duration_ms", System.currentTimeMillis() - startTime);
            logger.error("Erro ao validar senha: {}", logData, e);
            
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Erro ao validar senha", "message", e.getMessage()));
        }
    }

    /**
     * Health check endpoint
     * GET /api/users/health
     */
    @GetMapping("/health")
    public ResponseEntity<?> healthCheck() {
        Map<String, Object> health = new HashMap<>();
        health.put("status", "UP");
        health.put("service", "auth-module");
        health.put("timestamp", System.currentTimeMillis());
        
        logger.debug("Health check executado: {}", health);
        
        return ResponseEntity.ok(health);
    }
}