package com.dogbank.auth.controller;

import com.dogbank.auth.dto.AuthRequest;
import com.dogbank.auth.dto.LoginResponse;
import com.dogbank.auth.entity.User;
import com.dogbank.auth.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Objects;
import java.util.Optional;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository userRepository;

    public AuthController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthRequest request) {
        String cpf = request.getCpf() == null ? null : request.getCpf().trim();
        String pwd = request.getPassword();

        if (cpf == null || cpf.isBlank() || pwd == null || pwd.isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "cpf e senha são obrigatórios"));
        }

        Optional<User> userOpt = userRepository.findByCpf(cpf);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "User not found"));
        }

        User user = userOpt.get();
        if (!Objects.equals(pwd, user.getSenha())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid credentials"));
        }

        LoginResponse resp = new LoginResponse();
        resp.setMessage("Login successful");
        resp.setNome(user.getNome());
        resp.setChavePix(user.getChavePix());
        resp.setAccountId(user.getId());

        return ResponseEntity.ok(resp);
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

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }
}