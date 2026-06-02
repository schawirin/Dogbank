package com.dogbank.transaction.controller;

import com.dogbank.transaction.dto.TransactionRequest;
import com.dogbank.transaction.dto.TransactionResponse;
import com.dogbank.transaction.entity.Transaction;
import com.dogbank.transaction.service.IdempotencyService;
import com.dogbank.transaction.service.TransactionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/transactions")
@CrossOrigin(origins = "*")
public class TransactionController {

    private static final Logger log = LoggerFactory.getLogger(TransactionController.class);

    private final TransactionService transactionService;
    private final IdempotencyService idempotencyService;

    public TransactionController(TransactionService transactionService,
                                 IdempotencyService idempotencyService) {
        this.transactionService  = transactionService;
        this.idempotencyService  = idempotencyService;
    }

    @PostMapping("/pix")
    public ResponseEntity<?> transferirViaPix(
            @RequestBody TransactionRequest request,
            @RequestHeader(value = "X-Idempotency-Key", required = false) String idempotencyKey) {

        // Idempotency check — prevents double-spend on retries
        String effectiveKey = idempotencyKey != null ? idempotencyKey
                : "auto-" + request.getAccountOriginId() + "-" + request.getPixKeyDestination();
        String txId = UUID.randomUUID().toString();
        if (!idempotencyService.tryConsume(effectiveKey, txId)) {
            String existing = idempotencyService.getExistingTransactionId(effectiveKey);
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Duplicate request", "transactionId", existing != null ? existing : ""));
        }

        // Validação de senha obrigatória
        if (request.getPassword() == null || request.getPassword().trim().isEmpty()) {
            log.error("❌ Tentativa de PIX sem senha! Account: {}", request.getAccountOriginId());
            throw new RuntimeException("Senha é obrigatória para transferências PIX");
        }

        // Validar senha com auth-service
        boolean senhaValida = transactionService.validarSenha(request.getAccountOriginId(), request.getPassword());
        if (!senhaValida) {
            log.error("❌ Senha inválida para PIX! Account: {}", request.getAccountOriginId());
            throw new RuntimeException("Senha incorreta");
        }

        log.info("✅ Senha validada. Processando PIX...");
        ZonedDateTime startedAt = ZonedDateTime.now();
        Transaction tx = transactionService.transferirPix(
            request.getAccountOriginId(),
            request.getPixKeyDestination(),
            request.getAmount()
        );
        ZonedDateTime completedAt = ZonedDateTime.now();

        TransactionResponse resp = new TransactionResponse();
        resp.setTransactionId(tx.getId());
        resp.setMessage("Transferência via PIX concluída");
        resp.setStartedAt(startedAt);
        resp.setCompletedAt(completedAt);
        resp.setAuthCode(transactionService.generateAuthCode(tx));
        resp.setRecipientInitials(transactionService.extractInitials(tx.getReceiverName()));
        resp.setReceiverName(tx.getReceiverName());
        resp.setReceiverBank(tx.getReceiverBank());
        resp.setRecipientCpfMask(transactionService.maskCpf(tx.getPixKeyDestination()));
        resp.setAmount(tx.getAmount().doubleValue());
        resp.setSenderInitials(transactionService.extractInitials(tx.getSenderName()));
        resp.setSenderName(tx.getSenderName());
        resp.setSenderBankCode(tx.getSenderBankCode());
        resp.setSenderAgency(tx.getSenderAgency());
        resp.setSenderAccount(tx.getSenderAccountNumber());

        return ResponseEntity.ok(resp);
    }

    @GetMapping("/validate-pix-key")
    public ResponseEntity<?> validatePixKey(@RequestParam String pixKey) {
        try {
            log.info("🔍 [VULNERABLE ENDPOINT] Validando chave PIX: {}", pixKey);
            
            Map<String, Object> result = transactionService.getBalanceByPixKeyVulnerable(pixKey);
            
            if (Boolean.TRUE.equals(result.get("valid"))) {
                log.info("✅ Chave PIX válida encontrada");
                return ResponseEntity.ok(result);
            } else {
                log.warn("❌ Chave PIX inválida ou erro");
                return ResponseEntity.badRequest().body(result);
            }
            
        } catch (Exception e) {
            log.error("💥 Erro ao validar chave PIX: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of(
                "error", e.getMessage(),
                "valid", false
            ));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<TransactionResponse> getReceipt(@PathVariable Long id) {
        Transaction tx = transactionService.findById(id)
                .orElseThrow(() -> new RuntimeException("Transação não encontrada"));

        TransactionResponse resp = new TransactionResponse();
        resp.setTransactionId(tx.getId());
        resp.setMessage("Dados do PIX recuperados");
        resp.setStartedAt(tx.getStartedAt());
        resp.setCompletedAt(tx.getCompletedAt());
        resp.setAuthCode(transactionService.generateAuthCode(tx));
        resp.setRecipientInitials(transactionService.extractInitials(tx.getReceiverName()));
        resp.setReceiverName(tx.getReceiverName());
        resp.setReceiverBank(tx.getReceiverBank());
        resp.setRecipientCpfMask(transactionService.maskCpf(tx.getPixKeyDestination()));
        resp.setAmount(tx.getAmount().doubleValue());
        resp.setSenderInitials(transactionService.extractInitials(tx.getSenderName()));
        resp.setSenderName(tx.getSenderName());
        resp.setSenderBankCode(tx.getSenderBankCode());
        resp.setSenderAgency(tx.getSenderAgency());
        resp.setSenderAccount(tx.getSenderAccountNumber());

        return ResponseEntity.ok(resp);
    }

    @GetMapping
    public ResponseEntity<List<Transaction>> listarTransacoes(@RequestParam Long accountId) {
        return ResponseEntity.ok(transactionService.listarTransacoesPorConta(accountId));
    }

    @GetMapping("/account/{accountId}")
    public ResponseEntity<List<Transaction>> getTransactionsByAccountId(@PathVariable Long accountId) {
        return ResponseEntity.ok(transactionService.listarTransacoesPorConta(accountId));
    }
}