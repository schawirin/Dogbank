package com.dogbank.account.service;

import com.dogbank.account.entity.Account;
import com.dogbank.account.repository.AccountRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Service
public class AccountService {
    
    @Autowired
    private AccountRepository accountRepository;
    
    /**
     * Salvar ou atualizar conta
     */
    public Account save(Account account) {
        return accountRepository.save(account);
    }
    
    /**
     * Buscar todas as contas
     */
    public List<Account> findAll() {
        return accountRepository.findAll();
    }
    
    /**
     * Buscar conta por ID
     */
    public Optional<Account> findById(Long id) {
        return accountRepository.findById(id);
    }
    
    /**
     * Buscar conta por ID do usuário
     */
    public Optional<Account> findByUsuarioId(Long usuarioId) {
        return accountRepository.findByUsuarioId(usuarioId);
    }
    
    /**
     * Buscar conta por CPF do usuário
     */
    public Optional<Account> findByUserCpf(String cpf) {
        return accountRepository.findByUserCpf(cpf);
    }
    
    /**
     * Atualizar saldo da conta
     */
    @Transactional
    public boolean updateBalance(Long accountId, BigDecimal newBalance) {
        Optional<Account> accountOpt = accountRepository.findById(accountId);
        if (accountOpt.isPresent()) {
            Account account = accountOpt.get();
            account.setBalance(newBalance);
            accountRepository.save(account);
            return true;
        }
        return false;
    }
    
    /**
     * Deletar conta por ID
     */
    public void deleteById(Long id) {
        accountRepository.deleteById(id);
    }
}
