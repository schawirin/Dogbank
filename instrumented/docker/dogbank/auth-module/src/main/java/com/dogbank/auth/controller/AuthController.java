package com.dogbank.auth.controller;

import com.dogbank.auth.dto.AuthRequest;
import com.dogbank.auth.dto.LoginResponse;
import com.dogbank.auth.entity.User;
import com.dogbank.auth.repository.UserRepository;
import datadog.trace.api.EventTracker;
import datadog.trace.api.GlobalTracer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository userRepository;

    @Value("${dogbank.admin.block-token:changeme-block-token}")
    private String adminBlockToken;

    public AuthController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthRequest request) {
        String cpf = request.getCpf() == null ? null : request.getCpf().trim();
        String pwd = request.getPassword();
        EventTracker tracker = GlobalTracer.getEventTracker();

        if (cpf == null || cpf.isBlank() || pwd == null || pwd.isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "cpf e senha são obrigatórios"));
        }

        Optional<User> userOpt = userRepository.findByCpf(cpf);
        if (userOpt.isEmpty()) {
            // Conta NAO existe -> exists=false (sinaliza password spraying / enum)
            tracker.trackLoginFailureEvent(cpf, false, Map.of("reason", "user_not_found"));
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "User not found"));
        }

        User user = userOpt.get();

        if (user.getBlocked()) {
            // Conta marcada como comprometida pelo workflow do Datadog
            Map<String, String> meta = new HashMap<>();
            meta.put("usr.id", String.valueOf(user.getId()));
            meta.put("reason", "account_blocked");
            tracker.trackCustomEvent("users.login.blocked_attempt", meta);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Account temporarily blocked due to suspicious activity"));
        }

        if (!Objects.equals(pwd, user.getSenha())) {
            // Conta existe mas senha errada -> exists=true (sinal classico de credential stuffing)
            Map<String, String> meta = new HashMap<>();
            meta.put("usr.id", String.valueOf(user.getId()));
            meta.put("reason", "wrong_password");
            tracker.trackLoginFailureEvent(cpf, true, meta);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid credentials"));
        }

        // Sucesso -> emite users.login.success (Datadog correlaciona com falhas anteriores
        // para detectar Account Takeover / credential stuffing succeeded)
        Map<String, String> meta = new HashMap<>();
        meta.put("email", user.getEmail() == null ? "" : user.getEmail());
        tracker.trackLoginSuccessEvent(String.valueOf(user.getId()), meta);

        LoginResponse resp = new LoginResponse();
        resp.setMessage("Login successful");
        resp.setNome(user.getNome());
        resp.setChavePix(user.getChavePix());
        resp.setAccountId(user.getId());

        return ResponseEntity.ok(resp);
    }

    // =====================================================================
    // Admin endpoints - chamados pelo Datadog Workflow de ATO Response
    // Protegidos por header X-Admin-Token (env ADMIN_BLOCK_TOKEN / configmap)
    // =====================================================================

    @PostMapping("/admin/block-user")
    public ResponseEntity<?> blockUser(
            @RequestHeader(value = "X-Admin-Token", required = false) String token,
            @RequestBody Map<String, Object> body) {
        if (!Objects.equals(token, adminBlockToken)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "invalid admin token"));
        }
        Object userIdRaw = body.get("userId");
        String reason = String.valueOf(body.getOrDefault("reason", "manual"));
        if (userIdRaw == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "userId is required"));
        }
        Long userId;
        try {
            userId = Long.valueOf(String.valueOf(userIdRaw));
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "userId must be numeric"));
        }
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "user not found"));
        }
        User user = userOpt.get();
        user.setBlocked(true);
        userRepository.save(user);

        Map<String, String> meta = new HashMap<>();
        meta.put("usr.id", String.valueOf(user.getId()));
        meta.put("reason", reason);
        GlobalTracer.getEventTracker().trackCustomEvent("users.account.blocked", meta);

        return ResponseEntity.ok(Map.of(
                "status", "blocked",
                "userId", user.getId(),
                "reason", reason));
    }

    @PostMapping("/admin/unblock-user")
    public ResponseEntity<?> unblockUser(
            @RequestHeader(value = "X-Admin-Token", required = false) String token,
            @RequestBody Map<String, Object> body) {
        if (!Objects.equals(token, adminBlockToken)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "invalid admin token"));
        }
        Object userIdRaw = body.get("userId");
        if (userIdRaw == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "userId is required"));
        }
        Long userId;
        try {
            userId = Long.valueOf(String.valueOf(userIdRaw));
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "userId must be numeric"));
        }
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "user not found"));
        }
        User user = userOpt.get();
        user.setBlocked(false);
        userRepository.save(user);

        Map<String, String> meta = new HashMap<>();
        meta.put("usr.id", String.valueOf(user.getId()));
        GlobalTracer.getEventTracker().trackCustomEvent("users.account.unblocked", meta);

        return ResponseEntity.ok(Map.of("status", "unblocked", "userId", user.getId()));
    }

    @PostMapping("/validate-password")
    public ResponseEntity<?> validatePassword(@RequestBody Map<String, String> request) {
        String cpf = request.get("cpf");
        String password = request.get("password");
        
        if (cpf == null || password == null) {
            return ResponseEntity.badRequest()
                .body(Map.of("valid", false, "message", "CPF e senha são obrigatórios"));
        }
        
        Optional<User> userOpt = userRepository.findByCpf(cpf.trim());
        if (userOpt.isEmpty()) {
            return ResponseEntity.ok(Map.of("valid", false, "message", "Usuário não encontrado"));
        }
        
        User user = userOpt.get();
        if (!Objects.equals(password, user.getSenha())) {
            return ResponseEntity.ok(Map.of("valid", false, "message", "Senha incorreta"));
        }
        
        return ResponseEntity.ok(Map.of("valid", true));
    }

    @GetMapping("/validate-pix")
    public ResponseEntity<?> validatePix(@RequestParam String chavePix) {
        Optional<User> userOpt = userRepository.findByChavePix(chavePix.trim());
        if (userOpt.isEmpty()) {
            return ResponseEntity.ok(Map.of(
                    "valid", false,
                    "message", "Chave PIX não encontrada"
            ));
        }

        User user = userOpt.get();
        String banco = "DogBank";

        return ResponseEntity.ok(Map.of(
                "valid", true,
                "user", Map.of(
                        "nome", user.getNome(),
                        "banco", banco,
                        "cpf", user.getCpf()
                )
        ));
    }

    @GetMapping("/test-chave-pix/{chavePix}")
    public ResponseEntity<?> testarChavePix(@PathVariable String chavePix) {
        Optional<User> userOpt = userRepository.findByChavePix(chavePix.trim());
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "User not found by chavePix"));
        }
        User user = userOpt.get();
        return ResponseEntity.ok(Map.of(
                "message", "Usuário encontrado",
                "nome", user.getNome(),
                "cpf", user.getCpf()
        ));
    }

    /**
     * Busca usuário por chave PIX - Endpoint usado pelo transaction-service
     * GET /api/auth/pix-key/{pixKey}
     */
    @GetMapping("/pix-key/{pixKey}")
    public ResponseEntity<?> getUserByPixKey(@PathVariable String pixKey) {
        Optional<User> userOpt = userRepository.findByChavePix(pixKey.trim());
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Chave PIX não encontrada", "pixKey", pixKey));
        }
        
        User user = userOpt.get();
        // Retorna dados do usuário sem a senha
        return ResponseEntity.ok(Map.of(
                "id", user.getId(),
                "nome", user.getNome(),
                "cpf", user.getCpf(),
                "email", user.getEmail() != null ? user.getEmail() : "",
                "chavePix", user.getChavePix()
        ));
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }
}