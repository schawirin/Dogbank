package com.dogbank.transaction.service;

import com.dogbank.transaction.entity.Transaction;
import com.dogbank.transaction.model.AccountModel;
import com.dogbank.transaction.model.UserModel;
import com.dogbank.transaction.repository.TransactionRepository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.ZonedDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

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

            final String senderName = nvl(origin.getUserName(), "N/A");
            final String senderCpf  = maskCpf(nvl(origin.getCpf(), "N/A"));
            final String senderBank = nvl(origin.getBanco(), "DogBank");

            final String receiverName = nvl(userDest.getNome(), "N/A");
            final String receiverCpf  = maskCpf(nvl(userDest.getCpf(), "N/A"));
            final String receiverBank = nvl(dest.getBanco(), "DogBank");

            // LOG INÍCIO (campos de negócio)
            log.info("💸 [PIX INICIADO] Enviado por: {} (CPF: {}), Banco Origem: {}, Valor: R$ {}, " +
                            "Recebido por: {} (CPF: {}), Banco Destino: {}, Chave PIX: {}",
                    senderName, senderCpf, senderBank, amount, receiverName, receiverCpf, receiverBank, pixKeyDestination);

            // Validação no Banco Central
            log.info("🏦 Validando PIX no Banco Central - Chave: {}, Valor: R$ {}", pixKeyDestination, amount);
            Map<String, Object> validation = validarPixNoBancoCentral(pixKeyDestination, amount);

            if (validation == null || !"APPROVED".equals(validation.get("status"))) {
                String error = (String) (validation != null ? validation.get("error") : "unknown");
                String errorCode = (String) (validation != null ? validation.get("errorCode") : "unknown");
                log.error("❌ [BANCO CENTRAL REJEITOU] Code: {}, Error: {}, Enviado por: {}, Recebido por: {}, Valor: R$ {}",
                        errorCode, error, senderName, receiverName, amount);
                throw new RuntimeException("Erro no Banco Central: " + error);
            }

            log.info("✅ [BANCO CENTRAL] Validação aprovada");

            // Verifica saldo
            if (origin.getBalance() == null || amount == null || origin.getBalance().compareTo(amount) < 0) {
                log.error("❌ Saldo insuficiente - Enviado por: {}, Disponível: R$ {}, Necessário: R$ {}",
                        senderName, origin.getBalance(), amount);
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
            tx.setReceiverName(receiverName);
            tx.setReceiverBank(receiverBank);
            tx.setSenderName(senderName);
            tx.setSenderBankCode(senderBank);
            tx.setSenderAgency("");
            tx.setSenderAccountNumber(nvl(origin.getNumeroConta(), ""));
            tx.setDescription("PIX para " + receiverName);

            Transaction saved = transactionRepository.save(tx);

            long durationMs = Duration.between(startedAt, ZonedDateTime.now()).toMillis();

            // LOG FINAL (campos de negócio + duração)
            log.info("✅ [PIX CONCLUÍDO COM SUCESSO] Transaction ID: {}, Duração: {}ms, Enviado por: {} ({}), Valor: R$ {}, " +
                            "Recebido por: {} ({}), Banco Destino: {}",
                    saved.getId(), durationMs, senderName, senderBank, amount, receiverName, receiverCpf, receiverBank);

            return saved;

        } catch (RuntimeException e) {
            log.error("❌ [PIX FALHOU] Conta Origem: {}, Chave Destino: {}, Valor: R$ {}, Erro: {}",
                    accountOriginId, pixKeyDestination, amount, e.getMessage());
            throw e;
        }
    }

    // ---------- Helpers ----------
    private static String nvl(String s, String def) {
        return (s == null || s.isEmpty()) ? def : s;
    }

    private static String maskCpf(String cpf) {
        if (cpf == null || cpf.length() < 11) return cpf;
        // 123.456.789-01  ->  ***.***.***-01
        return "***.***.***-" + cpf.substring(cpf.length() - 2);
    }

    // ---------- Métodos usados (já devem existir no teu projeto).
    // Se estiverem em outros services/clients, mantenha as chamadas originais. Aqui só deixo a assinatura.
    private AccountModel getAccountById(Long id) { /* ... */ return null; }
    private UserModel getUserByPixKey(String pixKey) { /* ... */ return null; }
    private AccountModel getAccountByUserId(Long userId) { /* ... */ return null; }
    private void updateAccountBalance(Long accountId, BigDecimal newBalance) { /* ... */ }
    private Map<String, Object> validarPixNoBancoCentral(String chavePix, BigDecimal valor) {
        // chamada via restTemplate para o serviço bancocentral; retornar Map com status/error/errorCode
        return new HashMap<>();
    }
}
