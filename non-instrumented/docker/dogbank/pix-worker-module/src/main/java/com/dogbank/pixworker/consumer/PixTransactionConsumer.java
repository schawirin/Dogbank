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
import java.util.concurrent.TimeUnit;

@Component
@Slf4j
public class PixTransactionConsumer {

    private final BancoCentralService bancoCentralService;
    private final KafkaTemplate<String, PixResultMessage> resultKafkaTemplate;
    private final KafkaTemplate<String, Object> dlqKafkaTemplate;
    
    // Metrics
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
        
        // Initialize metrics
        this.processedCounter = Counter.builder("pix.transactions.processed")
                .description("Total PIX transactions processed")
                .tag("service", "pix-worker")
                .register(meterRegistry);
        
        this.successCounter = Counter.builder("pix.transactions.success")
                .description("Successful PIX transactions")
                .tag("service", "pix-worker")
                .register(meterRegistry);
        
        this.failedCounter = Counter.builder("pix.transactions.failed")
                .description("Failed PIX transactions")
                .tag("service", "pix-worker")
                .register(meterRegistry);
        
        this.dlqCounter = Counter.builder("pix.transactions.dlq")
                .description("PIX transactions sent to DLQ")
                .tag("service", "pix-worker")
                .register(meterRegistry);
        
        this.processingTimer = Timer.builder("pix.transactions.processing.time")
                .description("Time to process PIX transaction")
                .tag("service", "pix-worker")
                .register(meterRegistry);
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
        
        log.info("📥 Received PIX transaction: {} | Amount: R$ {} | Key: {}",
                transaction.getTransactionId(),
                transaction.getAmount(),
                transaction.getDestinationPixKey());
        
        try {
            processedCounter.increment();
            
            // Process with Banco Central
            BancoCentralResponse response = bancoCentralService.processTransaction(transaction);
            
            if (response.valid()) {
                // Success - send result
                handleSuccess(transaction, response);
                successCounter.increment();
            } else {
                // Failed - check if should retry
                handleFailure(transaction, response);
            }
            
            // Acknowledge message
            acknowledgment.acknowledge();
            
        } catch (Exception e) {
            log.error("❌ Error processing transaction {}: {}", 
                    transaction.getTransactionId(), e.getMessage(), e);
            
            // Send to DLQ after max retries
            if (transaction.getRetryCount() >= maxRetries) {
                sendToDlq(transaction, e.getMessage());
                acknowledgment.acknowledge();
            } else {
                // Don't acknowledge - will be redelivered
                failedCounter.increment();
            }
        } finally {
            long duration = System.currentTimeMillis() - startTime;
            processingTimer.record(duration, TimeUnit.MILLISECONDS);
            log.info("⏱️ Transaction {} processed in {}ms", 
                    transaction.getTransactionId(), duration);
        }
    }

    private void handleSuccess(PixTransactionMessage transaction, BancoCentralResponse response) {
        log.info("✅ Transaction {} completed successfully", transaction.getTransactionId());
        
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
        
        // Send to results topic
        resultKafkaTemplate.send(resultsTopic, transaction.getTransactionId(), result);
        
        // Send to notifications topic
        resultKafkaTemplate.send(notificationsTopic, transaction.getTransactionId(), result);
        
        log.info("📤 Result sent to {} and {}", resultsTopic, notificationsTopic);
    }

    private void handleFailure(PixTransactionMessage transaction, BancoCentralResponse response) {
        log.warn("⚠️ Transaction {} failed: {} - {}", 
                transaction.getTransactionId(), response.code(), response.message());
        
        // Check if it's a retryable error
        boolean retryable = isRetryableError(response.code());
        
        if (retryable && transaction.getRetryCount() < maxRetries) {
            log.info("🔄 Scheduling retry for transaction {} (attempt {})", 
                    transaction.getTransactionId(), transaction.getRetryCount() + 1);
            
            // Increment retry count and resend
            transaction.setRetryCount(transaction.getRetryCount() + 1);
            transaction.setStatus("RETRY");
            
            // Note: In a real system, you'd use a delay queue or scheduler
            // For demo, we just log it
            failedCounter.increment();
            
        } else {
            // Send final failure result
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
            
            failedCounter.increment();
        }
    }

    private void sendToDlq(PixTransactionMessage transaction, String errorMessage) {
        log.error("☠️ Sending transaction {} to DLQ after {} retries", 
                transaction.getTransactionId(), transaction.getRetryCount());
        
        transaction.setStatus("DLQ");
        dlqKafkaTemplate.send(dlqTopic, transaction.getTransactionId(), transaction);
        dlqCounter.increment();
    }

    private boolean isRetryableError(String code) {
        // Retryable errors: timeouts, temporary unavailability
        return code != null && (
                code.equals("BC408") || // Timeout
                code.equals("BC503") || // Service unavailable
                code.equals("BC429")    // Rate limited
        );
    }
}
