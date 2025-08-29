package com.dogbank.account.controller;

import com.dogbank.account.dto.AccountInfoDTO;
import com.dogbank.account.entity.Account;
import com.dogbank.account.service.AccountService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Optional;

@RestController
@RequestMapping("/api/accounts")
public class AccountController {

    @Autowired
    private AccountService accountService;

    /**
     * Retorna a conta pelo seu ID, caso exista.
     * GET /api/accounts/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<Account> getAccount(@PathVariable Long id) {
        // Supõe que getAccountById retorne Optional<Account>
        Optional<Account> accountOpt = accountService.getAccountById(id);
        if (accountOpt.isPresent()) {
            return ResponseEntity.ok(accountOpt.get());
        } else {
            return ResponseEntity.notFound().build();
        }
    }

    
    /**
     * Cria uma nova conta.
     * POST /api/accounts
     */
    @PostMapping
    public ResponseEntity<Account> createAccount(@RequestBody Account account) {
        Account created = accountService.createAccount(account);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /**
     * Atualiza o saldo da conta.
     * PUT /api/accounts/{id}/balance?balance=100.00
     *
     * Aqui, o service retorna Account ou null.
     */
    @PutMapping("/{id}/balance")
    public ResponseEntity<Account> updateBalance(
            @PathVariable Long id,
            @RequestParam BigDecimal balance
    ) {
        // Se o service retorna null ao não encontrar a conta:
        Account updatedAccount = accountService.updateBalance(id, balance);

        if (updatedAccount == null) {
            // 404 caso não exista conta com esse ID
            return ResponseEntity.notFound().build();
        }
        // 200 OK com a conta atualizada
        return ResponseEntity.ok(updatedAccount);
    }
    @GetMapping("/user/{cpf}")
public ResponseEntity<Account> getAccountByUserCpf(@PathVariable String cpf) {
    Optional<Account> accountOpt = accountService.getAccountByUserCpf(cpf);
    if (accountOpt.isPresent()) {
        return ResponseEntity.ok(accountOpt.get());
    } else {
        return ResponseEntity.notFound().build();
    }
}
    /**
     * Retorna um DTO com informações detalhadas da conta (saldo, nome, etc.).
     * GET /api/accounts/{id}/info
     */
    @GetMapping("/{id}/info")
    public ResponseEntity<AccountInfoDTO> getAccountInfo(@PathVariable("id") Long id) {
        Optional<Account> accountOpt = accountService.getAccountById(id);
        if (accountOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Account account = accountOpt.get();

        // Usa o nome do usuário se existir, caso contrário, define "Usuário Desconhecido"
        String userName = (account.getUserName() != null && !account.getUserName().isEmpty())
                ? account.getUserName() : "Usuário Desconhecido";

        // Converte o saldo para Double, usando 0.0 se nulo
        Double saldo = (account.getBalance() != null) ? account.getBalance().doubleValue() : 0.0;
        // Converte o saldo investido para Double, usando 0.0 se nulo
        Double saldoInvestido = (account.getSaldoInvestido() != null)
                ? account.getSaldoInvestido().doubleValue()
                : 0.0;

        AccountInfoDTO dto = new AccountInfoDTO(
                account.getId(),
                userName,
                saldo,
                saldoInvestido
        );
        return ResponseEntity.ok(dto);
    }
}
