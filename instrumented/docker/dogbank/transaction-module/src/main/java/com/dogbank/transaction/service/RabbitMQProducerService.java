package com.dogbank.transaction.service;

import com.dogbank.transaction.config.RabbitMQProducerConfig;
import com.dogbank.transaction.event.PixTransactionEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

/**
 * RabbitMQ Producer Service
 * 
 * Publishes PIX transactions to RabbitMQ for FIFO processing
 * Works alongside Kafka (which handles event sourcing)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RabbitMQProducerService {

    private final RabbitTemplate rabbitTemplate;

    /**
     * Publish PIX transaction to RabbitMQ fanout exchange
     * The message will be routed to all bound queues:
     * - pix.fraud (fraud detection)
     * - pix.balance (balance update)
     * - pix.notification (user notification)
     * - pix.audit (audit logging)
     */
    public void publishPixTransaction(PixTransactionEvent event) {
        try {
            log.info("📤 Publishing PIX to RabbitMQ - TX: {}, Amount: R$ {}",
                event.getTransactionId(),
                event.getAmount());

            rabbitTemplate.convertAndSend(
                RabbitMQProducerConfig.EXCHANGE_PROCESSING,
                "", // routing key not used for fanout
                event
            );

            log.info("✅ PIX published to RabbitMQ exchange: {}", 
                RabbitMQProducerConfig.EXCHANGE_PROCESSING);

        } catch (Exception e) {
            log.error("❌ Failed to publish PIX to RabbitMQ: {}", e.getMessage(), e);
            // Don't throw - Kafka will still have the event for recovery
        }
    }
}
