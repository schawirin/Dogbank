package com.dogbank.transaction.controller;

import com.dogbank.transaction.dto.TransactionRequest;
import com.dogbank.transaction.dto.TransactionResponse;
import com.dogbank.transaction.entity.Transaction;
import com.dogbank.transaction.service.TransactionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.ZonedDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/transactions")
public class TransactionController {

    private final TransactionService transactionService;

    public TransactionController(TransactionService transactionService) {
        this.transactionService = transactionService;
    }

    @PostMapping("/pix")
    public ResponseEntity<TransactionResponse> transferirViaPix(@RequestBody TransactionRequest request) {
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
