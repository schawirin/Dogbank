package com.dogbank.transaction.service;

import com.dogbank.transaction.entity.Transaction;
import com.dogbank.transaction.repository.TransactionRepository;
import com.dogbank.transaction.model.AccountModel;
import com.dogbank.transaction.model.UserModel;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class TransactionService {
    
    @Autowired
    private TransactionRepository transactionRepository;
    
    @Autowired
    private RestTemplate restTemplate;
    
    @Value("${bancocentral.api.url}")
    private String bancoCentralUrl;
    
    @Value("${account.api.url}")
    private String accountServiceUrl;
    
    @Value("${auth.api.url}")
    private String authServiceUrl;
    
    /**
     * Executa a transferência via PIX e retorna a entidade Transaction persistida
     */
    @Transactional
    public Transaction transferirPix(Long accountOriginId, String pixKeyDestination, BigDecimal amount) {
        ZonedDateTime startedAt = ZonedDateTime.now();
        
        // Origem - Simulando chamada REST para account-module
        AccountModel origin = getAccountById(accountOriginId);
        if (origin == null) {
            throw new RuntimeException("Conta de origem não encontrada");
        }
        
        // Destino: simulando chamada REST para auth-module e account-module
        UserModel userDest = getUserByPixKey(pixKeyDestination);
        if (userDest == null) {
            throw new RuntimeException("Chave Pix de destino não encontrada");
        }
        
        AccountModel dest = getAccountByUserId(userDest.getId());
        if (dest == null) {
            throw new RuntimeException("Conta de destino não encontrada");
        }
        
        // Validação externa
        Map<String, Object> validation = validarPixNoBancoCentral(pixKeyDestination, amount);
        if (!"APPROVED".equals(validation.get("status"))) {
            throw new RuntimeException("Erro no Banco Central: " + validation.get("error"));
        }
        
        // Verifica saldo
        if (origin.getBalance().compareTo(amount) < 0) {
            throw new RuntimeException("Saldo insuficiente");
        }
        
        // Simulando atualização de saldo via chamadas REST
        updateAccountBalance(origin.getId(), origin.getBalance().subtract(amount));
        updateAccountBalance(dest.getId(), dest.getBalance().add(amount));
        
        // Persiste transação
        Transaction tx = new Transaction();
        tx.setAccountOriginId(accountOriginId);
        tx.setAccountDestinationId(dest.getId());
        tx.setAmount(amount);
        tx.setType("PIX");
        tx.setStartedAt(startedAt);
        tx.setCompletedAt(ZonedDateTime.now());
        tx.setPixKeyDestination(pixKeyDestination);
        tx.setReceiverName(pixKeyDestination);
        tx.setReceiverBank("");
        tx.setSenderName("");
        tx.setSenderBankCode("");
        tx.setSenderAgency("");
        tx.setSenderAccountNumber("");
        tx.setDescription("PIX para chave " + pixKeyDestination);
        return transactionRepository.save(tx);
    }
    
    public Optional<Transaction> findById(Long id) {
        return transactionRepository.findById(id);
    }
    
    public List<Transaction> listarTransacoesPorConta(Long accountId) {
        return transactionRepository.findAllByAccountOriginIdOrderByDateDesc(accountId);
    }
    
    public String generateAuthCode(Transaction tx) {
        return UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }
    
    public String extractInitials(String fullName) {
        if (fullName == null || fullName.isBlank()) return "";
        return Stream.of(fullName.split("\\s+"))
                     .filter(s -> !s.isBlank())
                     .map(s -> s.substring(0, 1).toUpperCase())
                     .limit(2)
                     .collect(Collectors.joining());
    }
    
    public String maskCpf(String pixKey) {
        if (pixKey == null) return "";
        if (pixKey.contains("@")) {
            String[] parts = pixKey.split("@", 2);
            return parts[0].charAt(0) + "****@" + parts[1];
        }
        int len = pixKey.length();
        if (len <= 4) return pixKey;
        return "****" + pixKey.substring(len - 4);
    }
    
    @SuppressWarnings("unchecked")
    private Map<String, Object> validarPixNoBancoCentral(String pixKey, BigDecimal amount) {
        Map<String, Object> req = new HashMap<>();
        req.put("pixKey", pixKey);
        req.put("amount", amount);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(req, headers);
        try {
            ResponseEntity<Map> resp = restTemplate.exchange(
                bancoCentralUrl, HttpMethod.POST, entity, Map.class);
            return resp.getBody();
        } catch (Exception e) {
            Map<String, Object> err = new HashMap<>();
            err.put("status", "FAILED");
            err.put("error", "Erro na validação externa: " + e.getMessage());
            return err;
        }
    }
    
    private AccountModel getAccountById(Long accountId) {
        AccountModel account = new AccountModel();
        account.setId(accountId);
        account.setBalance(new BigDecimal("1000.00"));
        return account;
    }
    
    private UserModel getUserByPixKey(String pixKey) {
        UserModel user = new UserModel();
        user.setId(1L);
        user.setNome("Usuário Simulado");
        user.setChavePix(pixKey);
        return user;
    }
    
    private AccountModel getAccountByUserId(Long userId) {
        AccountModel account = new AccountModel();
        account.setId(2L);
        account.setUsuarioId(userId);
        account.setBalance(new BigDecimal("500.00"));
        return account;
    }
    
    private void updateAccountBalance(Long accountId, BigDecimal newBalance) {
        // Simulação
    }
}