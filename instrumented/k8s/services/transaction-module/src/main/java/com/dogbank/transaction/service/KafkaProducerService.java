package com.dogbank.transaction.service;

import com.dogbank.transaction.event.PixTransactionEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Service;
import org.springframework.util.concurrent.ListenableFuture;
import org.springframework.util.concurrent.ListenableFutureCallback;

/**
 * Kafka Producer Service for PIX transactions
 * 
 * Uses ListenableFuture for Spring Boot 2.7 compatibility
 * (CompletableFuture is only available in Spring Boot 3.x)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class KafkaProducerService {

    private final KafkaTemplate<String, Object> kafkaTemplate;

    @Value("${kafka.topics.transactions:pix-transactions}")
    private String transactionsTopic;

    @Value("${kafka.enabled:true}")
    private boolean kafkaEnabled;

    /**
     * Sends a PIX transaction event to Kafka for async processing
     * 
     * @param event The transaction event to send
     * @return ListenableFuture with the send result
     */
    public ListenableFuture<SendResult<String, Object>> sendPixTransaction(PixTransactionEvent event) {
        if (!kafkaEnabled) {
            log.warn("⚠️ Kafka is disabled, skipping event: {}", event.getTransactionId());
            return null;
        }

        log.info("📤 Sending PIX transaction to Kafka: {} | Amount: R$ {} | Key: {}",
                event.getTransactionId(),
                event.getAmount(),
                event.getDestinationPixKey());

        ListenableFuture<SendResult<String, Object>> future = 
            kafkaTemplate.send(transactionsTopic, event.getTransactionId(), event);
        
        future.addCallback(new ListenableFutureCallback<SendResult<String, Object>>() {
            @Override
            public void onSuccess(SendResult<String, Object> result) {
                log.info("✅ PIX transaction sent to Kafka successfully: {} | Partition: {} | Offset: {}",
                        event.getTransactionId(),
                        result.getRecordMetadata().partition(),
                        result.getRecordMetadata().offset());
            }

            @Override
            public void onFailure(Throwable ex) {
                log.error("❌ Failed to send PIX transaction to Kafka: {} | Error: {}",
                        event.getTransactionId(),
                        ex.getMessage());
            }
        });
        
        return future;
    }
}
