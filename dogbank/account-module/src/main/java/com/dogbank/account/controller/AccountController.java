package com.dogbank.account.controller;

import com.dogbank.account.entity.Account;
import com.dogbank.account.service.AccountService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/accounts")
@CrossOrigin(origins = "*")
public class AccountController {
    
    @Autowired
    private AccountService accountService;
    
    /**
     * Criar nova conta
     */
    @PostMapping
    public ResponseEntity<Account> createAccount(@RequestBody Account account) {
        Account created = accountService.save(account);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
    
    /**
     * Listar todas as contas
     */
    @GetMapping
    public ResponseEntity<List<Account>> getAllAccounts() {
        List<Account> accounts = accountService.findAll();
        return ResponseEntity.ok(accounts);
    }
    
    /**
     * Buscar conta por ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<Account> getAccountById(@PathVariable Long id) {
        return accountService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
    
    /**
     * Buscar conta por ID do usuário
     */
    @GetMapping("/user/{userId}")
    public ResponseEntity<Account> getAccountByUserId(@PathVariable Long userId) {
        return accountService.findByUsuarioId(userId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
    
    /**
     * Buscar conta por CPF do usuário
     */
    @GetMapping("/user/cpf/{cpf}")
    public ResponseEntity<Account> getAccountByCpf(@PathVariable String cpf) {
        return accountService.findByUserCpf(cpf)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
    
    /**
     * Buscar saldo da conta por ID
     */
    @GetMapping("/{id}/balance")
    public ResponseEntity<?> getBalance(@PathVariable Long id) {
        return accountService.findById(id)
                .map(account -> ResponseEntity.ok(Map.of(
                    "balance", account.getBalance(),
                    "saldo", account.getBalance()
                )))
                .orElse(ResponseEntity.notFound().build());
    }
    
    /**
     * Atualizar saldo da conta
     */
    @PutMapping("/{id}/balance")
    public ResponseEntity<?> updateBalance(
            @PathVariable Long id, 
            @RequestBody Map<String, BigDecimal> request) {
        
        BigDecimal newBalance = request.get("balance");
        if (newBalance == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Balance is required"));
        }
        
        boolean updated = accountService.updateBalance(id, newBalance);
        if (updated) {
            return ResponseEntity.ok()
                    .body(Map.of("message", "Balance updated successfully"));
        }
        return ResponseEntity.notFound().build();
    }
    
    /**
     * Atualizar conta completa
     */
    @PutMapping("/{id}")
    public ResponseEntity<Account> updateAccount(
            @PathVariable Long id, 
            @RequestBody Account accountDetails) {
        
        Optional<Account> accountOpt = accountService.findById(id);
        if (accountOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        Account account = accountOpt.get();
        account.setBalance(accountDetails.getBalance());
        account.setAccountType(accountDetails.getAccountType());
        // Atualizar outros campos conforme necessário
        
        Account updated = accountService.save(account);
        return ResponseEntity.ok(updated);
    }
    
    /**
     * Deletar conta
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteAccount(@PathVariable Long id) {
        if (accountService.findById(id).isPresent()) {
            accountService.deleteById(id);
            return ResponseEntity.ok()
                    .body(Map.of("message", "Account deleted successfully"));
        }
        return ResponseEntity.notFound().build();
    }
}
