package com.dogbank.account.service;

import com.dogbank.account.entity.Account;
import com.dogbank.account.repository.AccountRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Optional;

@Service
public class AccountService {

    @Autowired
    private AccountRepository accountRepository;

    public Optional<Account> getAccountById(Long id) {
        return accountRepository.findById(id);
    }

    public Optional<Account> getAccountByAccountNumber(String accountNumber) {
        return accountRepository.findByAccountNumber(accountNumber);
    }

    public Account createAccount(Account account) {
        return accountRepository.save(account);
    }

    public Account updateBalance(Long id, BigDecimal newBalance) {
        Account account = accountRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Conta não encontrada"));
        account.setBalance(newBalance);
        return accountRepository.save(account);
    } // Estava faltando este colchete de fechamento!

    // Método adicionado para buscar conta por CPF
    public Optional<Account> getAccountByUserCpf(String cpf) {
        return accountRepository.findByUserCpf(cpf);
    }
}