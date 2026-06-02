package com.dogbank.fraud.consumer;

import com.dogbank.fraud.model.FraudAnalysisResult;
import com.dogbank.fraud.model.FraudEvent;
import com.dogbank.fraud.model.PixTransaction;
import com.dogbank.fraud.service.FraudDetectionService;
import com.dogbank.fraud.service.VelocityCheckService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class FraudKafkaConsumer {

    private final FraudDetectionService fraudDetectionService;
    private final VelocityCheckService velocityCheckService;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    @Value("${kafka.topics.fraud-events:fraud-events}")
    private String fraudEventsTopic;

    @Value("${kafka.topics.notification-dispatch:notification-dispatch}")
    private String notificationTopic;

    @Value("${kafka.topics.audit-log:audit-log}")
    private String auditLogTopic;

    @KafkaListener(
            topics = "${kafka.topics.transactions:pix-transactions}",
            groupId = "${spring.kafka.consumer.group-id:fraud-detection-group}",
            containerFactory = "kafkaListenerContainerFactory"
    )
    public void analyzeTransaction(ConsumerRecord<String, PixTransaction> record, Acknowledgment ack) {
        PixTransaction tx = record.value();

        if (tx == null) {
            log.warn("Received null transaction at partition={} offset={}", record.partition(), record.offset());
            ack.acknowledge();
            return;
        }

        log.info("📥 [Fraud] Received txn={} amount=R${} from partition={} offset={}",
                tx.getTransactionId(), tx.getAmount(), record.partition(), record.offset());

        try {
            // Dedup: skip if we already processed this txnId
            if (velocityCheckService.isAlreadySeen(tx.getTransactionId())) {
                log.warn("⚠️ [Fraud] Duplicate txn={}, skipping", tx.getTransactionId());
                ack.acknowledge();
                return;
            }

            // Block check
            if (velocityCheckService.isUserBlocked(tx.getSourceAccountId())) {
                log.warn("🔒 [Fraud] Account {} is blocked, auto-rejecting txn={}",
                        tx.getSourceAccountId(), tx.getTransactionId());
                publishFraudEvent(tx, buildBlockedResult(tx), "ACCOUNT_BLOCKED");
                ack.acknowledge();
                return;
            }

            // Velocity check before ML analysis
            VelocityCheckService.VelocityResult velocity =
                    velocityCheckService.recordAndCheck(tx.getDestinationPixKey(), tx.getTransactionId());

            if (velocity.exceeded()) {
                log.warn("🚀 [Fraud] Velocity exceeded for pixKey={} — 1m={} 1h={}",
                        tx.getDestinationPixKey(), velocity.countPerMinute(), velocity.countPerHour());
            }

            // ML simulation
            FraudAnalysisResult result = fraudDetectionService.analyzeTransaction(tx);

            // Escalate to block if velocity is critical
            if (velocity.exceededPerMinute() && !"BLOCKED".equals(result.getDecision())) {
                result = FraudAnalysisResult.builder()
                        .transactionId(result.getTransactionId())
                        .isFraudulent(true)
                        .riskScore(0.95)
                        .riskLevel("CRITICAL")
                        .riskFactors(appendFactor(result.getRiskFactors(), "VELOCITY_EXCEEDED_1M"))
                        .decision("BLOCKED")
                        .requiresCoafNotification(result.isRequiresCoafNotification())
                        .analyzedAt(LocalDateTime.now())
                        .processingTimeMs(result.getProcessingTimeMs())
                        .build();

                velocityCheckService.blockUser(tx.getSourceAccountId(), 24);
            }

            publishFraudEvent(tx, result, null);

            if (result.isFraudulent()) {
                log.warn("🚨 [Fraud] FRAUD DETECTED txn={} score={} decision={}",
                        tx.getTransactionId(), result.getRiskScore(), result.getDecision());
            } else {
                log.info("✅ [Fraud] Approved txn={} score={} level={}",
                        tx.getTransactionId(), result.getRiskScore(), result.getRiskLevel());
            }

            ack.acknowledge();

        } catch (Exception e) {
            log.error("❌ [Fraud] Error processing txn={}: {}", tx.getTransactionId(), e.getMessage(), e);
            // Don't ack — let Kafka retry (or DLQ after max retries if configured)
        }
    }

    private void publishFraudEvent(PixTransaction tx, FraudAnalysisResult result, String overrideReason) {
        FraudEvent event = FraudEvent.builder()
                .transactionId(tx.getTransactionId())
                .correlationId(tx.getCorrelationId())
                .decision(result.getDecision())
                .riskLevel(result.getRiskLevel())
                .riskScore(result.getRiskScore())
                .fraudulent(result.isFraudulent())
                .requiresCoafReport(result.isRequiresCoafNotification())
                .riskFactors(result.getRiskFactors())
                .processingTimeMs(result.getProcessingTimeMs())
                .analyzedAt(result.getAnalyzedAt())
                .sourceAccountId(tx.getSourceAccountId())
                .destinationPixKey(tx.getDestinationPixKey())
                .amountBrl(tx.getAmount() != null ? tx.getAmount().toPlainString() : "0")
                .build();

        kafkaTemplate.send(fraudEventsTopic, tx.getTransactionId(), event);

        // Notify user if fraud detected or blocked
        if (result.isFraudulent() || "BLOCKED".equals(result.getDecision())) {
            kafkaTemplate.send(notificationTopic, tx.getTransactionId(),
                    buildNotificationPayload(tx, result));
        }

        // Always audit
        kafkaTemplate.send(auditLogTopic, tx.getTransactionId(), buildAuditPayload(tx, result, overrideReason));
    }

    private FraudAnalysisResult buildBlockedResult(PixTransaction tx) {
        return FraudAnalysisResult.builder()
                .transactionId(tx.getTransactionId())
                .isFraudulent(true)
                .riskScore(1.0)
                .riskLevel("CRITICAL")
                .riskFactors(List.of("ACCOUNT_BLOCKED"))
                .decision("BLOCKED")
                .requiresCoafNotification(false)
                .analyzedAt(LocalDateTime.now())
                .processingTimeMs(0)
                .build();
    }

    private java.util.Map<String, Object> buildNotificationPayload(PixTransaction tx, FraudAnalysisResult result) {
        return java.util.Map.of(
                "type", "FRAUD_ALERT",
                "channel", "PUSH",
                "userId", tx.getSourceAccountId(),
                "transactionId", tx.getTransactionId(),
                "message", "Transação bloqueada por suspeita de fraude. Risk: " + result.getRiskLevel(),
                "timestamp", LocalDateTime.now().toString()
        );
    }

    private java.util.Map<String, Object> buildAuditPayload(PixTransaction tx, FraudAnalysisResult result,
                                                             String extraReason) {
        return java.util.Map.of(
                "event", "FRAUD_ANALYSIS_COMPLETED",
                "transactionId", tx.getTransactionId(),
                "accountId", tx.getSourceAccountId() != null ? tx.getSourceAccountId() : "",
                "decision", result.getDecision(),
                "riskScore", result.getRiskScore(),
                "riskLevel", result.getRiskLevel(),
                "fraudulent", result.isFraudulent(),
                "service", "fraud-detection-service",
                "timestamp", LocalDateTime.now().toString()
        );
    }

    private List<String> appendFactor(List<String> factors, String newFactor) {
        List<String> list = new ArrayList<>(factors != null ? factors : List.of());
        list.add(newFactor);
        return list;
    }
}
