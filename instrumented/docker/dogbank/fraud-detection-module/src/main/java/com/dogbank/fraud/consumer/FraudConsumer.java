package com.dogbank.fraud.consumer;

import com.dogbank.fraud.config.RabbitMQConfig;
import com.dogbank.fraud.model.FraudAnalysisResult;
import com.dogbank.fraud.model.PixTransaction;
import com.dogbank.fraud.service.FraudDetectionService;
import com.rabbitmq.client.Channel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Component;

/**
 * RabbitMQ Consumer for Fraud Detection
 * 
 * Processes PIX transactions from the pix.fraud queue
 * with manual acknowledgment for guaranteed processing
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FraudConsumer {

    private final FraudDetectionService fraudDetectionService;

    @RabbitListener(
        queues = RabbitMQConfig.QUEUE_FRAUD,
        containerFactory = "rabbitListenerContainerFactory",
        ackMode = "MANUAL"
    )
    public void processTransaction(
            PixTransaction transaction,
            Channel channel,
            @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag) {
        
        log.info("📥 Received transaction for fraud analysis: {} - Amount: R$ {}",
            transaction.getTransactionId(),
            transaction.getAmount());

        try {
            // Analyze transaction
            FraudAnalysisResult result = fraudDetectionService.analyzeTransaction(transaction);

            // Log result
            if (result.isFraudulent()) {
                log.warn("🚨 FRAUD DETECTED - TX: {}, Risk Score: {}, Factors: {}",
                    result.getTransactionId(),
                    result.getRiskScore(),
                    result.getRiskFactors());
            } else if ("MANUAL_REVIEW".equals(result.getDecision())) {
                log.warn("⚠️ Manual review required - TX: {}, Risk Score: {}",
                    result.getTransactionId(),
                    result.getRiskScore());
            } else {
                log.info("✅ Transaction approved - TX: {}, Risk Score: {}",
                    result.getTransactionId(),
                    result.getRiskScore());
            }

            // Acknowledge message
            channel.basicAck(deliveryTag, false);
            log.debug("✓ Message acknowledged: {}", deliveryTag);

        } catch (Exception e) {
            log.error("❌ Error processing transaction {}: {}",
                transaction.getTransactionId(), e.getMessage(), e);
            
            try {
                // Reject and send to DLQ (requeue = false)
                channel.basicNack(deliveryTag, false, false);
                log.warn("Message sent to DLQ: {}", deliveryTag);
            } catch (Exception nackEx) {
                log.error("Failed to nack message: {}", nackEx.getMessage());
            }
        }
    }
}
