package com.dogbank.pixworker.consumer;

import com.dogbank.pixworker.model.PixResultMessage;
import com.dogbank.pixworker.model.PixTransactionMessage;
import com.dogbank.pixworker.service.BancoCentralService;
import com.dogbank.pixworker.service.BancoCentralService.BancoCentralResponse;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Component
@Slf4j
public class PixTransactionConsumer {

    private final BancoCentralService bancoCentralService;
    private final KafkaTemplate<String, PixResultMessage> resultKafkaTemplate;
    private final KafkaTemplate<String, Object> dlqKafkaTemplate;

    private final Counter processedCounter;
    private final Counter successCounter;
    private final Counter failedCounter;
    private final Counter dlqCounter;
    private final Timer processingTimer;

    @Value("${kafka.topics.results:pix-results}")
    private String resultsTopic;

    @Value("${kafka.topics.notifications:pix-notifications}")
    private String notificationsTopic;

    @Value("${kafka.topics.dlq:pix-dlq}")
    private String dlqTopic;

    @Value("${kafka.topics.account-events:account-events}")
    private String accountEventsTopic;

    @Value("${kafka.topics.notification-dispatch:notification-dispatch}")
    private String notificationDispatchTopic;

    @Value("${kafka.topics.audit-log:audit-log}")
    private String auditLogTopic;

    @Value("${pix.worker.max-retries:3}")
    private int maxRetries;

    public PixTransactionConsumer(
            BancoCentralService bancoCentralService,
            KafkaTemplate<String, PixResultMessage> resultKafkaTemplate,
            KafkaTemplate<String, Object> dlqKafkaTemplate,
            MeterRegistry meterRegistry) {

        this.bancoCentralService = bancoCentralService;
        this.resultKafkaTemplate = resultKafkaTemplate;
        this.dlqKafkaTemplate = dlqKafkaTemplate;

        this.processedCounter = Counter.builder("pix.transactions.processed")
                .tag("service", "pix-worker").register(meterRegistry);
        this.successCounter = Counter.builder("pix.transactions.success")
                .tag("service", "pix-worker").register(meterRegistry);
        this.failedCounter = Counter.builder("pix.transactions.failed")
                .tag("service", "pix-worker").register(meterRegistry);
        this.dlqCounter = Counter.builder("pix.transactions.dlq")
                .tag("service", "pix-worker").register(meterRegistry);
        this.processingTimer = Timer.builder("pix.transactions.processing.time")
                .tag("service", "pix-worker").register(meterRegistry);
    }

    @KafkaListener(
        topics = "${kafka.topics.transactions:pix-transactions}",
        groupId = "${spring.kafka.consumer.group-id}",
        containerFactory = "kafkaListenerContainerFactory"
    )
    public void consumeTransaction(
            ConsumerRecord<String, PixTransactionMessage> record,
            Acknowledgment acknowledgment) {

        long startTime = System.currentTimeMillis();
        PixTransactionMessage transaction = record.value();

        log.info("📥 Received PIX txn={} amount=R${} pixKey={}",
                transaction.getTransactionId(), transaction.getAmount(),
                transaction.getDestinationPixKey());

        try {
            processedCounter.increment();

            BancoCentralResponse response = bancoCentralService.processTransaction(transaction);

            if (response.valid()) {
                handleSuccess(transaction, response);
                successCounter.increment();
            } else {
                handleFailure(transaction, response);
            }

            acknowledgment.acknowledge();

        } catch (Exception e) {
            log.error("❌ Error processing txn={}: {}", transaction.getTransactionId(), e.getMessage(), e);
            if (transaction.getRetryCount() >= maxRetries) {
                sendToDlq(transaction, e.getMessage());
                acknowledgment.acknowledge();
            } else {
                failedCounter.increment();
            }
        } finally {
            long duration = System.currentTimeMillis() - startTime;
            processingTimer.record(duration, TimeUnit.MILLISECONDS);
        }
    }

    private void handleSuccess(PixTransactionMessage transaction, BancoCentralResponse response) {
        log.info("✅ PIX txn={} completed", transaction.getTransactionId());

        PixResultMessage result = PixResultMessage.builder()
                .transactionId(transaction.getTransactionId())
                .correlationId(transaction.getCorrelationId())
                .status("COMPLETED")
                .message("PIX realizado com sucesso")
                .bancoCentralCode(response.code())
                .processedAt(LocalDateTime.now())
                .sourceUserEmail(transaction.getSourceUserEmail())
                .destinationUserEmail(transaction.getDestinationUserEmail())
                .amount(transaction.getAmount().toString())
                .build();

        resultKafkaTemplate.send(resultsTopic, transaction.getTransactionId(), result);
        resultKafkaTemplate.send(notificationsTopic, transaction.getTransactionId(), result);

        // account-events: trigger balance update in cache-sync-service
        dlqKafkaTemplate.send(accountEventsTopic, transaction.getTransactionId(),
                buildAccountEvent(transaction, "BALANCE_DEBITED", "COMPLETED"));

        // notification-dispatch: user-facing confirmation
        dlqKafkaTemplate.send(notificationDispatchTopic, transaction.getTransactionId(),
                buildNotification(transaction, "PIX_COMPLETED",
                        "PIX de R$ " + transaction.getAmount() + " enviado com sucesso!"));

        // audit-log: immutable record
        dlqKafkaTemplate.send(auditLogTopic, transaction.getTransactionId(),
                buildAudit(transaction, "PIX_COMPLETED", response.code()));
    }

    private void handleFailure(PixTransactionMessage transaction, BancoCentralResponse response) {
        log.warn("⚠️ PIX txn={} failed: {} - {}",
                transaction.getTransactionId(), response.code(), response.message());

        boolean retryable = isRetryableError(response.code());

        if (retryable && transaction.getRetryCount() < maxRetries) {
            transaction.setRetryCount(transaction.getRetryCount() + 1);
            transaction.setStatus("RETRY");
            failedCounter.increment();
        } else {
            PixResultMessage result = PixResultMessage.builder()
                    .transactionId(transaction.getTransactionId())
                    .correlationId(transaction.getCorrelationId())
                    .status("FAILED")
                    .message(response.message())
                    .bancoCentralCode(response.code())
                    .processedAt(LocalDateTime.now())
                    .sourceUserEmail(transaction.getSourceUserEmail())
                    .destinationUserEmail(transaction.getDestinationUserEmail())
                    .amount(transaction.getAmount().toString())
                    .build();

            resultKafkaTemplate.send(resultsTopic, transaction.getTransactionId(), result);
            resultKafkaTemplate.send(notificationsTopic, transaction.getTransactionId(), result);

            dlqKafkaTemplate.send(notificationDispatchTopic, transaction.getTransactionId(),
                    buildNotification(transaction, "PIX_FAILED",
                            "Falha ao enviar PIX de R$ " + transaction.getAmount() + ". Código: " + response.code()));

            dlqKafkaTemplate.send(auditLogTopic, transaction.getTransactionId(),
                    buildAudit(transaction, "PIX_FAILED", response.code()));

            failedCounter.increment();
        }
    }

    private void sendToDlq(PixTransactionMessage transaction, String errorMessage) {
        log.error("☠️ Sending txn={} to DLQ after {} retries",
                transaction.getTransactionId(), transaction.getRetryCount());
        transaction.setStatus("DLQ");
        dlqKafkaTemplate.send(dlqTopic, transaction.getTransactionId(), transaction);
        dlqKafkaTemplate.send(auditLogTopic, transaction.getTransactionId(),
                buildAudit(transaction, "PIX_DLQ", "MAX_RETRIES_EXCEEDED"));
        dlqCounter.increment();
    }

    private Map<String, Object> buildAccountEvent(PixTransactionMessage tx, String eventType, String status) {
        Map<String, Object> e = new HashMap<>();
        e.put("eventType", eventType);
        e.put("accountId", tx.getSourceAccountId());
        e.put("transactionId", tx.getTransactionId());
        e.put("amount", tx.getAmount() != null ? tx.getAmount().toPlainString() : "0");
        e.put("currency", "BRL");
        e.put("status", status);
        e.put("service", "pix-worker");
        e.put("timestamp", LocalDateTime.now().toString());
        return e;
    }

    private Map<String, Object> buildNotification(PixTransactionMessage tx, String type, String message) {
        Map<String, Object> n = new HashMap<>();
        n.put("type", type);
        n.put("channel", "PUSH");
        n.put("userId", tx.getSourceAccountId());
        n.put("transactionId", tx.getTransactionId());
        n.put("message", message);
        n.put("timestamp", LocalDateTime.now().toString());
        return n;
    }

    private Map<String, Object> buildAudit(PixTransactionMessage tx, String event, String code) {
        Map<String, Object> a = new HashMap<>();
        a.put("event", event);
        a.put("transactionId", tx.getTransactionId());
        a.put("accountId", tx.getSourceAccountId());
        a.put("destinationPixKey", tx.getDestinationPixKey());
        a.put("amount", tx.getAmount() != null ? tx.getAmount().toPlainString() : "0");
        a.put("bancoCentralCode", code);
        a.put("service", "pix-worker");
        a.put("timestamp", LocalDateTime.now().toString());
        return a;
    }

    private boolean isRetryableError(String code) {
        return code != null && (code.equals("BC408") || code.equals("BC503") || code.equals("BC429"));
    }
}
