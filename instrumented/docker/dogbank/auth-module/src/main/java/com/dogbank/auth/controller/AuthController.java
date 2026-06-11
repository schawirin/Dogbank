package com.dogbank.auth.controller;

import com.dogbank.auth.dto.AuthRequest;
import com.dogbank.auth.dto.LoginResponse;
import com.dogbank.auth.entity.User;
import com.dogbank.auth.repository.UserRepository;
import com.dogbank.auth.service.AuthEventPublisher;
import com.dogbank.auth.service.RateLimitService;
import datadog.trace.api.EventTracker;
import datadog.trace.api.GlobalTracer;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger logger = LogManager.getLogger(AuthController.class);

    private final UserRepository userRepository;
    private final RateLimitService rateLimitService;
    private final AuthEventPublisher authEventPublisher;

    @Value("${dogbank.admin.block-token:changeme-block-token}")
    private String adminBlockToken;

    @Value("${dogbank.demo.log4shell.enabled:false}")
    private boolean log4shellDemoEnabled;

    public AuthController(UserRepository userRepository,
                          RateLimitService rateLimitService,
                          AuthEventPublisher authEventPublisher) {
        this.userRepository     = userRepository;
        this.rateLimitService   = rateLimitService;
        this.authEventPublisher = authEventPublisher;
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

        // Rate limit check (Redis sliding window)
        if (rateLimitService.isBlocked(cpf)) {
            authEventPublisher.publishRateLimitBlock(cpf);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of("error", "Too many failed attempts. Try again in 15 minutes."));
        }

        Optional<User> userOpt = userRepository.findByCpf(cpf);
        if (userOpt.isEmpty()) {
            tracker.trackLoginFailureEvent(cpf, false, Map.of("reason", "user_not_found"));
            rateLimitService.recordFailedAttempt(cpf);
            authEventPublisher.publishLoginFailure(cpf, "user_not_found", false);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "User not found"));
        }

        User user = userOpt.get();

        if (user.getBlocked()) {
            Map<String, String> meta = new HashMap<>();
            meta.put("usr.id", String.valueOf(user.getId()));
            meta.put("reason", "account_blocked");
            tracker.trackCustomEvent("users.login.blocked_attempt", meta);
            authEventPublisher.publishLoginFailure(cpf, "account_blocked", true);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Account temporarily blocked due to suspicious activity"));
        }

        if (!Objects.equals(pwd, user.getSenha())) {
            Map<String, String> meta = new HashMap<>();
            meta.put("usr.id", String.valueOf(user.getId()));
            meta.put("reason", "wrong_password");
            tracker.trackLoginFailureEvent(cpf, true, meta);
            boolean nowBlocked = rateLimitService.recordFailedAttempt(cpf);
            authEventPublisher.publishLoginFailure(cpf, "wrong_password", true);
            if (nowBlocked) {
                authEventPublisher.publishAccountBlocked(String.valueOf(user.getId()), cpf, "rate_limit");
            }
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid credentials"));
        }

        // Login success — clear rate limit counters and emit events
        rateLimitService.clearAttempts(cpf);
        Map<String, String> meta = new HashMap<>();
        meta.put("email", user.getEmail() == null ? "" : user.getEmail());
        tracker.trackLoginSuccessEvent(String.valueOf(user.getId()), meta);
        authEventPublisher.publishLoginSuccess(String.valueOf(user.getId()), cpf,
                user.getEmail() != null ? user.getEmail() : "");

        LoginResponse resp = new LoginResponse();
        resp.setMessage("Login successful");
        resp.setNome(user.getNome());
        resp.setChavePix(user.getChavePix());
        resp.setAccountId(user.getId());

        return ResponseEntity.ok(resp);
    }

    @PostMapping("/lab/log4shell")
    public ResponseEntity<?> log4shellLab(
            @RequestHeader(value = "X-Api-Version", required = false) String apiVersion,
            @RequestHeader(value = "User-Agent", required = false) String userAgent,
            @RequestHeader(value = "X-EvilDog-Run", required = false) String evilDogRun,
            HttpServletRequest servletRequest) {
        if (!log4shellDemoEnabled) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "lab endpoint disabled"));
        }

        String payload = firstNonBlank(apiVersion, userAgent, servletRequest.getHeader("Referer"), "no-payload");
        String runId = evilDogRun == null || evilDogRun.isBlank()
                ? "log4shell-" + UUID.randomUUID()
                : evilDogRun;

        Map<String, String> meta = new HashMap<>();
        meta.put("runId", runId);
        meta.put("endpoint", "/api/auth/lab/log4shell");
        meta.put("clientIp", servletRequest.getRemoteAddr());
        meta.put("userAgent", userAgent == null ? "" : userAgent);
        GlobalTracer.getEventTracker().trackCustomEvent("dogbank.log4shell.demo.payload_logged", meta);

        // DogBank lab only: intentionally logs untrusted input with vulnerable Log4j.
        logger.error("dogbank-log4shell-lab runId=" + runId + " payload=" + payload);

        return ResponseEntity.ok(Map.of(
                "status", "payload_logged",
                "runId", runId,
                "endpoint", "/api/auth/lab/log4shell"));
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return "";
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
