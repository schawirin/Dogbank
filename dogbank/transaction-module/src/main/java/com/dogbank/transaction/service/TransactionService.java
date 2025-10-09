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
    
    try {
        // Buscar conta origem
        AccountModel origin = getAccountById(accountOriginId);
        if (origin == null) {
            log.error("❌ Conta de origem não encontrada: {}", accountOriginId);
            throw new RuntimeException("Conta de origem não encontrada");
        }
        
        // Buscar usuário e conta destino
        UserModel userDest = getUserByPixKey(pixKeyDestination);
        if (userDest == null) {
            log.error("❌ Chave Pix de destino não encontrada: {}", pixKeyDestination);
            throw new RuntimeException("Chave Pix de destino não encontrada");
        }
        
        AccountModel dest = getAccountByUserId(userDest.getId());
        if (dest == null) {
            log.error("❌ Conta de destino não encontrada para usuário: {}", userDest.getId());
            throw new RuntimeException("Conta de destino não encontrada");
        }
        
        // LOG MELHORADO COM TODOS OS DETALHES
        log.info("💸 [PIX INICIADO] " +
                "Enviado por: {}, " +
                "CPF Origem: {}, " +
                "Banco Origem: {}, " +
                "Valor: R$ {}, " +
                "Recebido por: {}, " +
                "CPF Destino: {}, " +
                "Banco Destino: {}, " +
                "Chave PIX: {}",
                origin.getUserName() != null ? origin.getUserName() : "N/A",
                origin.getCpf() != null ? maskCpf(origin.getCpf()) : "N/A",
                origin.getBanco() != null ? origin.getBanco() : "DogBank",
                amount,
                userDest.getNome(),
                userDest.getCpf() != null ? maskCpf(userDest.getCpf()) : "N/A",
                dest.getBanco() != null ? dest.getBanco() : "DogBank",
                pixKeyDestination
        );
        
        // Validação no Banco Central
        log.info("🏦 Validando PIX no Banco Central - Chave: {}, Valor: R$ {}", pixKeyDestination, amount);
        Map<String, Object> validation = validarPixNoBancoCentral(pixKeyDestination, amount);
        
        if (!"APPROVED".equals(validation.get("status"))) {
            String error = (String) validation.get("error");
            String errorCode = (String) validation.get("errorCode");
            log.error("❌ [BANCO CENTRAL REJEITOU] " +
                    "Code: {}, " +
                    "Error: {}, " +
                    "Enviado por: {}, " +
                    "Recebido por: {}, " +
                    "Valor: R$ {}",
                    errorCode, error,
                    origin.getUserName(),
                    userDest.getNome(),
                    amount
            );
            throw new RuntimeException("Erro no Banco Central: " + error);
        }
        
        log.info("✅ [BANCO CENTRAL] Validação aprovada");
        
        // Verifica saldo
        if (origin.getBalance().compareTo(amount) < 0) {
            log.error("❌ Saldo insuficiente - " +
                    "Enviado por: {}, " +
                    "Disponível: R$ {}, " +
                    "Necessário: R$ {}",
                    origin.getUserName(),
                    origin.getBalance(),
                    amount
            );
            throw new RuntimeException("Saldo insuficiente");
        }
        
        // Atualiza saldos
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
        tx.setReceiverName(userDest.getNome());
        tx.setReceiverBank(dest.getBanco() != null ? dest.getBanco() : "DogBank");
        tx.setSenderName(origin.getUserName() != null ? origin.getUserName() : "");
        tx.setSenderBankCode(origin.getBanco() != null ? origin.getBanco() : "DogBank");
        tx.setSenderAgency("");
        tx.setSenderAccountNumber(origin.getNumeroConta() != null ? origin.getNumeroConta() : "");
        tx.setDescription("PIX para " + userDest.getNome());
        
        Transaction saved = transactionRepository.save(tx);
        
        long durationMs = ZonedDateTime.now().toInstant().toEpochMilli() - 
                         startedAt.toInstant().toEpochMilli();
        
        // LOG FINAL COM TODOS OS DETALHES
        log.info("✅ [PIX CONCLUÍDO COM SUCESSO] " +
                "Transaction ID: {}, " +
                "Duração: {}ms, " +
                "Enviado por: {} ({}), " +
                "Valor: R$ {}, " +
                "Recebido por: {} ({}), " +
                "Banco Destino: {}",
                saved.getId(),
                durationMs,
                origin.getUserName(),
                origin.getBanco(),
                amount,
                userDest.getNome(),
                dest.getBanco(),
                dest.getBanco()
        );
        
        return saved;
        
    } catch (RuntimeException e) {
        log.error("❌ [PIX FALHOU] " +
                "Conta Origem: {}, " +
                "Chave Destino: {}, " +
                "Valor: R$ {}, " +
                "Erro: {}",
                accountOriginId,
                pixKeyDestination,
                amount,
                e.getMessage()
        );
        throw e;
    }
}
}