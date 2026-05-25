package com.dogbank.transaction.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Service;
import org.springframework.util.concurrent.ListenableFuture;
import org.springframework.util.concurrent.ListenableFutureCallback;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * Event Publisher Service - Publica eventos para Kafka
 * Tópicos:
 * - banking.accounts: eventos de atualização de saldo
 * - banking.transactions: eventos de transações PIX (completed/failed)
 */
@Service
public class EventPublisherService {

    private static final Logger log = LoggerFactory.getLogger(EventPublisherService.class);

    private static final String TOPIC_ACCOUNTS = "banking.accounts";
    private static final String TOPIC_TRANSACTIONS = "banking.transactions";

    @Autowired
    private KafkaTemplate<String, Object> kafkaTemplate;

    @Value("${kafka.event-publisher.enabled:true}")
    private boolean enabled;

    /**
     * Publica evento de saldo atualizado
     * Evento: balance.updated
     * Tópico: banking.accounts
     */
    public void publishBalanceUpdated(
            Long accountId,
            BigDecimal delta,
            BigDecimal newBalance,
            String reason,
            String transactionId
    ) {
        if (!enabled) {
            log.debug("Event publisher disabled, skipping balance.updated event");
            return;
        }

        try {
            Map<String, Object> event = new HashMap<>();
            event.put("event_type", "balance.updated");
            event.put("account_id", accountId);
            event.put("delta", delta);
            event.put("new_balance", newBalance);
            event.put("reason", reason);
            event.put("transaction_id", transactionId);
            event.put("timestamp", Instant.now().toString());

            // Use accountId as partition key for ordering
            String key = String.valueOf(accountId);

            ListenableFuture<SendResult<String, Object>> future =
                kafkaTemplate.send(TOPIC_ACCOUNTS, key, event);

            future.addCallback(new ListenableFutureCallback<SendResult<String, Object>>() {
                @Override
                public void onSuccess(SendResult<String, Object> result) {
                    log.info("📤 Published balance.updated event to Kafka - account_id={}, delta={}, new_balance={}, reason={}",
                        accountId, delta, newBalance, reason);
                }

                @Override
                public void onFailure(Throwable ex) {
                    log.error("❌ Failed to publish balance.updated event to Kafka - account_id={}: {}",
                        accountId, ex.getMessage(), ex);
                }
            });

        } catch (Exception e) {
            log.error("❌ Error publishing balance.updated event - account_id={}: {}", accountId, e.getMessage(), e);
        }
    }

    /**
     * Publica evento de PIX concluído
     * Evento: pix.completed
     * Tópico: banking.transactions
     */
    public void publishPixCompleted(
            String transactionId,
            Long accountOriginId,
            Long accountDestId,
            BigDecimal amount,
            String pixKeyDest,
            BigDecimal balanceOriginAfter,
            BigDecimal balanceDestAfter
    ) {
        if (!enabled) {
            log.debug("Event publisher disabled, skipping pix.completed event");
            return;
        }

        try {
            Map<String, Object> event = new HashMap<>();
            event.put("event_type", "pix.completed");
            event.put("transaction_id", transactionId);
            event.put("account_origin_id", accountOriginId);
            event.put("account_dest_id", accountDestId);
            event.put("amount", amount);
            event.put("pix_key_dest", pixKeyDest);
            event.put("balance_origin_after", balanceOriginAfter);
            event.put("balance_dest_after", balanceDestAfter);
            event.put("timestamp", Instant.now().toString());

            // Use transactionId as partition key
            String key = transactionId;

            ListenableFuture<SendResult<String, Object>> future =
                kafkaTemplate.send(TOPIC_TRANSACTIONS, key, event);

            future.addCallback(new ListenableFutureCallback<SendResult<String, Object>>() {
                @Override
                public void onSuccess(SendResult<String, Object> result) {
                    log.info("📤 Published pix.completed event to Kafka - transaction_id={}, amount={}, origin={}, dest={}",
                        transactionId, amount, accountOriginId, accountDestId);
                }

                @Override
                public void onFailure(Throwable ex) {
                    log.error("❌ Failed to publish pix.completed event to Kafka - transaction_id={}: {}",
                        transactionId, ex.getMessage(), ex);
                }
            });

        } catch (Exception e) {
            log.error("❌ Error publishing pix.completed event - transaction_id={}: {}", transactionId, e.getMessage(), e);
        }
    }

    /**
     * Publica evento de PIX falhado
     * Evento: pix.failed
     * Tópico: banking.transactions
     */
    public void publishPixFailed(
            String transactionId,
            Long accountOriginId,
            String reason,
            String errorCode
    ) {
        if (!enabled) {
            log.debug("Event publisher disabled, skipping pix.failed event");
            return;
        }

        try {
            Map<String, Object> event = new HashMap<>();
            event.put("event_type", "pix.failed");
            event.put("transaction_id", transactionId);
            event.put("account_origin_id", accountOriginId);
            event.put("reason", reason);
            event.put("error_code", errorCode);
            event.put("timestamp", Instant.now().toString());

            // Use transactionId as partition key
            String key = transactionId;

            ListenableFuture<SendResult<String, Object>> future =
                kafkaTemplate.send(TOPIC_TRANSACTIONS, key, event);

            future.addCallback(new ListenableFutureCallback<SendResult<String, Object>>() {
                @Override
                public void onSuccess(SendResult<String, Object> result) {
                    log.info("📤 Published pix.failed event to Kafka - transaction_id={}, reason={}, error_code={}",
                        transactionId, reason, errorCode);
                }

                @Override
                public void onFailure(Throwable ex) {
                    log.error("❌ Failed to publish pix.failed event to Kafka - transaction_id={}: {}",
                        transactionId, ex.getMessage(), ex);
                }
            });

        } catch (Exception e) {
            log.error("❌ Error publishing pix.failed event - transaction_id={}: {}", transactionId, e.getMessage(), e);
        }
    }
}
