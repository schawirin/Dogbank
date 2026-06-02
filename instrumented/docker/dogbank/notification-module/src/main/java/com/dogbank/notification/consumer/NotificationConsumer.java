package com.dogbank.notification.consumer;

import com.dogbank.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Kafka consumer for notification-dispatch topic.
 *
 * Expected message shape:
 * {
 *   "type":          "FRAUD_ALERT" | "PIX_COMPLETED" | "PIX_FAILED" | "LOGIN_ALERT" | "ACCOUNT_UPDATE",
 *   "channel":       "PUSH" | "EMAIL" | "SMS",
 *   "userId":        "...",
 *   "transactionId": "...",   (optional)
 *   "message":       "...",
 *   "timestamp":     "..."
 * }
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class NotificationConsumer {

    private final NotificationService notificationService;

    @KafkaListener(
            topics = "${kafka.topics.notification-dispatch:notification-dispatch}",
            groupId = "${spring.kafka.consumer.group-id:notification-service-group}",
            containerFactory = "kafkaListenerContainerFactory"
    )
    public void consume(ConsumerRecord<String, Map> record, Acknowledgment ack) {
        Map<?, ?> payload = record.value();

        if (payload == null) {
            log.warn("[Notification] Null payload at partition={} offset={}", record.partition(), record.offset());
            ack.acknowledge();
            return;
        }

        String type    = str(payload, "type");
        String channel = str(payload, "channel");
        String userId  = str(payload, "userId");
        String txId    = str(payload, "transactionId");
        String message = str(payload, "message");

        log.info("📬 [Notification] type={} channel={} userId={} txId={}", type, channel, userId, txId);

        try {
            switch (channel != null ? channel : "PUSH") {
                case "EMAIL" -> notificationService.sendEmail(userId, type, message, txId);
                case "SMS"   -> notificationService.sendSms(userId, type, message);
                default      -> notificationService.sendPush(userId, type, message, txId);
            }
            ack.acknowledge();
        } catch (Exception e) {
            log.error("[Notification] Failed to dispatch type={} userId={}: {}", type, userId, e.getMessage(), e);
            // Don't ack — let Kafka retry up to consumer's max.poll.interval
        }
    }

    private String str(Map<?, ?> map, String key) {
        Object v = map.get(key);
        return v != null ? v.toString() : null;
    }
}
