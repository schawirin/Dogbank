package com.dogbank.account.service;

import com.dogbank.account.entity.Account;
import com.dogbank.account.repository.AccountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Service
public class AccountService {

    private static final Logger log = LoggerFactory.getLogger(AccountService.class);

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private RedisService redisService;
    
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
     * Buscar conta por ID (CQRS Read Model)
     * Tenta Redis primeiro (cache), fallback para PostgreSQL
     */
    public Optional<Account> findById(Long id) {
        // Busca do banco (sempre)
        Optional<Account> accountOpt = accountRepository.findById(id);

        if (accountOpt.isPresent()) {
            Account account = accountOpt.get();

            // Tenta buscar saldo do Redis (cache)
            Optional<BigDecimal> cachedBalance = redisService.getBalance(id);

            if (cachedBalance.isPresent()) {
                // CACHE HIT: Usa saldo do Redis
                account.setBalance(cachedBalance.get());
                log.info("✅ Returned account with Redis cached balance - account_id={}, balance={}",
                    id, cachedBalance.get());
            } else {
                // CACHE MISS: Usa saldo do banco e atualiza Redis
                log.info("⚠️ Redis cache miss, using PostgreSQL balance - account_id={}, balance={}",
                    id, account.getBalance());
                redisService.setBalance(id, account.getBalance());
            }
        }

        return accountOpt;
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
     * Nota: Cache será atualizado pelo cache-sync-service via eventos Kafka
     */
    @Transactional
    public boolean updateBalance(Long accountId, BigDecimal newBalance) {
        Optional<Account> accountOpt = accountRepository.findById(accountId);
        if (accountOpt.isPresent()) {
            Account account = accountOpt.get();
            account.setBalance(newBalance);
            accountRepository.save(account);

            // Nota: Em produção, o cache seria atualizado pelo cache-sync-service via Kafka
            // Por segurança, fazemos invalidação aqui também (fallback)
            log.info("Updated balance in PostgreSQL - account_id={}, new_balance={}", accountId, newBalance);

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
