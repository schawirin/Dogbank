package com.dogbank.transaction.service;

import com.dogbank.transaction.entity.Transaction;
import com.dogbank.transaction.repository.TransactionRepository;
import com.dogbank.transaction.model.AccountModel;
import com.dogbank.transaction.model.UserModel;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class TransactionService {
    
    private static final Logger log = LoggerFactory.getLogger(TransactionService.class);
    
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
        log.info("🚀 [PIX] Iniciando transferência - Origem: {}, Destino: {}, Valor: R$ {}", 
                 accountOriginId, pixKeyDestination, amount);
        
        ZonedDateTime startedAt = ZonedDateTime.now();
        
        try {
            // Origem - Simulando chamada REST para account-module
            log.debug("📊 Buscando conta de origem: {}", accountOriginId);
            AccountModel origin = getAccountById(accountOriginId);
            if (origin == null) {
                log.error("❌ Conta de origem não encontrada: {}", accountOriginId);
                throw new RuntimeException("Conta de origem não encontrada");
            }
            log.debug("✅ Conta origem encontrada - Saldo: R$ {}", origin.getBalance());
            
            // Destino: simulando chamada REST para auth-module e account-module
            log.debug("🔍 Buscando usuário pela chave PIX: {}", pixKeyDestination);
            UserModel userDest = getUserByPixKey(pixKeyDestination);
            if (userDest == null) {
                log.error("❌ Chave Pix de destino não encontrada: {}", pixKeyDestination);
                throw new RuntimeException("Chave Pix de destino não encontrada");
            }
            log.debug("✅ Usuário destino encontrado: {}", userDest.getNome());
            
            log.debug("📊 Buscando conta do destinatário: {}", userDest.getId());
            AccountModel dest = getAccountByUserId(userDest.getId());
            if (dest == null) {
                log.error("❌ Conta de destino não encontrada para usuário: {}", userDest.getId());
                throw new RuntimeException("Conta de destino não encontrada");
            }
            log.debug("✅ Conta destino encontrada");
            
            // Validação externa
            log.info("🏦 Validando PIX no Banco Central - Chave: {}, Valor: R$ {}", pixKeyDestination, amount);
            Map<String, Object> validation = validarPixNoBancoCentral(pixKeyDestination, amount);
            
            if (!"APPROVED".equals(validation.get("status"))) {
                String error = (String) validation.get("error");
                String errorCode = (String) validation.get("errorCode");
                log.error("❌ [BANCO CENTRAL] Transação rejeitada - Code: {}, Error: {}", errorCode, error);
                throw new RuntimeException("Erro no Banco Central: " + error);
            }
            log.info("✅ [BANCO CENTRAL] Validação aprovada");
            
            // Verifica saldo
            if (origin.getBalance().compareTo(amount) < 0) {
                log.error("❌ Saldo insuficiente - Disponível: R$ {}, Necessário: R$ {}", 
                         origin.getBalance(), amount);
                throw new RuntimeException("Saldo insuficiente");
            }
            log.debug("✅ Saldo verificado");
            
            // Simulando atualização de saldo via chamadas REST
            log.debug("💰 Atualizando saldos - Débito origem / Crédito destino");
            updateAccountBalance(origin.getId(), origin.getBalance().subtract(amount));
            updateAccountBalance(dest.getId(), dest.getBalance().add(amount));
            log.debug("✅ Saldos atualizados");
            
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
            
            Transaction saved = transactionRepository.save(tx);
            
            long durationMs = ZonedDateTime.now().toInstant().toEpochMilli() - 
                             startedAt.toInstant().toEpochMilli();
            
            log.info("✅ [PIX CONCLUÍDO] ID: {}, Duração: {}ms, Origem: {}, Destino: {}, Valor: R$ {}", 
                     saved.getId(), durationMs, accountOriginId, pixKeyDestination, amount);
            
            return saved;
            
        } catch (RuntimeException e) {
            log.error("❌ [PIX FALHOU] Erro na transferência - Origem: {}, Destino: {}, Valor: R$ {}, Error: {}", 
                     accountOriginId, pixKeyDestination, amount, e.getMessage());
            throw e;
        }
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
            log.debug("🌐 Chamando Banco Central: {} - Request: {}", bancoCentralUrl, req);
            
            ResponseEntity<Map> resp = restTemplate.exchange(
                bancoCentralUrl, 
                HttpMethod.POST, 
                entity, 
                Map.class
            );
            
            Map<String, Object> body = resp.getBody();
            log.debug("📥 Resposta do Banco Central: {}", body);
            
            return body;
            
        } catch (HttpClientErrorException e) {
            // Erros 4xx (Bad Request, Not Found, etc)
            String errorBody = e.getResponseBodyAsString();
            log.error("❌ [BANCO CENTRAL] Erro HTTP {} - Body: {}", e.getStatusCode(), errorBody);
            
            Map<String, Object> err = new HashMap<>();
            err.put("status", "FAILED");
            err.put("error", "Erro na validação: " + errorBody);
            err.put("errorCode", "HTTP-" + e.getStatusCode().value());
            return err;
            
        } catch (HttpServerErrorException e) {
            // Erros 5xx (Internal Server Error, etc)
            String errorBody = e.getResponseBodyAsString();
            log.error("❌ [BANCO CENTRAL] Erro do servidor {} - Body: {}", e.getStatusCode(), errorBody);
            
            Map<String, Object> err = new HashMap<>();
            err.put("status", "FAILED");
            err.put("error", "Erro interno do Banco Central");
            err.put("errorCode", "HTTP-" + e.getStatusCode().value());
            return err;
            
        } catch (ResourceAccessException e) {
            // Timeout ou erro de conexão
            log.error("⏱️ [TIMEOUT/CONNECTION] Erro ao conectar com Banco Central: {}", e.getMessage());
            log.error("📍 URL tentada: {}", bancoCentralUrl);
            
            Map<String, Object> err = new HashMap<>();
            err.put("status", "FAILED");
            err.put("error", "Timeout ao conectar com Banco Central. Tente novamente em alguns instantes.");
            err.put("errorCode", "PIX-TIMEOUT");
            return err;
            
        } catch (Exception e) {
            // Qualquer outro erro
            log.error("❌ [BANCO CENTRAL] Erro inesperado: {} - {}", e.getClass().getSimpleName(), e.getMessage(), e);
            
            Map<String, Object> err = new HashMap<>();
            err.put("status", "FAILED");
            err.put("error", "Erro na validação externa: " + e.getMessage());
            err.put("errorCode", "PIX-ERRO-GENERICO");
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
        log.debug("💳 Saldo atualizado - Conta: {}, Novo saldo: R$ {}", accountId, newBalance);
    }
}