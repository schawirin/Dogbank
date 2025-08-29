package com.dogbank.auth.controller;
import com.dogbank.auth.dto.AuthRequest;
import com.dogbank.auth.dto.LoginResponse;
import com.dogbank.auth.entity.User;
import com.dogbank.auth.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.util.Optional;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    @Autowired private UserRepository userRepository;
    
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthRequest request) {
        Optional<User> userOpt = userRepository.findByCpf(request.getCpf().trim());
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                                 .body("{\"error\":\"User not found\"}");
        }
        
        User user = userOpt.get();
        if (!request.getPassword().equals(user.getSenha())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                                 .body("{\"error\":\"Invalid credentials\"}");
        }
        
        // Simplificado: não acessamos mais o AccountRepository diretamente
        // Em uma implementação real, faríamos uma chamada REST para o account-module
        LoginResponse resp = new LoginResponse();
        resp.setMessage("Login successful");
        resp.setNome(user.getNome());
        resp.setChavePix(user.getChavePix());
        resp.setAccountId(user.getId()); // Usando ID do usuário como substituto temporário
        
        return ResponseEntity.ok(resp);
    }
    
    @GetMapping("/validate-pix")
    public ResponseEntity<?> validatePix(@RequestParam String chavePix) {
        Optional<User> userOpt = userRepository.findByChavePix(chavePix.trim());
        if (userOpt.isEmpty()) {
            return ResponseEntity.ok(
                "{\"valid\":false,\"message\":\"Chave PIX não encontrada\"}"
            );
        }
        
        User user = userOpt.get();
        // Valor fixo para o banco - sem dependências da classe Account
        String banco = "DogBank";
        
        return ResponseEntity.ok(
            "{\"valid\":true,\"user\":{" +
            "\"nome\":\"" + user.getNome() + "\"," +
            "\"banco\":\"" + banco + "\"," +
            "\"cpf\":\"" + user.getCpf() + "\"}}"
        );
    }
    
    @GetMapping("/test-chave-pix/{chavePix}")
    public ResponseEntity<?> testarChavePix(@PathVariable String chavePix) {
        Optional<User> userOpt = userRepository.findByChavePix(chavePix.trim());
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                                 .body("{\"error\":\"User not found by chavePix\"}");
        }
        User user = userOpt.get();
        return ResponseEntity.ok(
            String.format("{\"message\":\"Usuário encontrado\",\"nome\":\"%s\",\"cpf\":\"%s\"}",
                          user.getNome(), user.getCpf())
        );
    }
}
