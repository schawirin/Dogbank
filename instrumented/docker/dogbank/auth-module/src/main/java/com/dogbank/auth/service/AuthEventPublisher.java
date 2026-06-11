package com.dogbank.auth.service;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Service
public class AuthEventPublisher {

    private static final Logger log = LogManager.getLogger(AuthEventPublisher.class);

    private final KafkaTemplate<String, Object> kafkaTemplate;

    public AuthEventPublisher(KafkaTemplate<String, Object> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    @Value("${kafka.topics.auth-events:auth-events}")
    private String authEventsTopic;

    @Value("${kafka.topics.audit-log:audit-log}")
    private String auditLogTopic;

    @Value("${kafka.topics.notification-dispatch:notification-dispatch}")
    private String notificationTopic;

    public void publishLoginSuccess(String userId, String cpf, String email) {
        Map<String, Object> event = event("LOGIN_SUCCESS", userId, cpf);
        event.put("email", email);
        send(authEventsTopic, userId, event);
        sendAudit("LOGIN_SUCCESS", userId, cpf, null);
    }

    public void publishLoginFailure(String cpf, String reason, boolean userExists) {
        Map<String, Object> event = event("LOGIN_FAILURE", null, cpf);
        event.put("reason", reason);
        event.put("userExists", userExists);
        send(authEventsTopic, cpf, event);
        sendAudit("LOGIN_FAILURE", null, cpf, reason);
    }

    public void publishAccountBlocked(String userId, String cpf, String reason) {
        Map<String, Object> event = event("ACCOUNT_BLOCKED", userId, cpf);
        event.put("reason", reason);
        send(authEventsTopic, userId, event);
        sendAudit("ACCOUNT_BLOCKED", userId, cpf, reason);

        // Notify user via notification-dispatch
        Map<String, Object> notification = new HashMap<>();
        notification.put("type", "ACCOUNT_BLOCKED");
        notification.put("channel", "PUSH");
        notification.put("userId", userId);
        notification.put("message", "Sua conta foi temporariamente bloqueada por atividade suspeita.");
        notification.put("timestamp", LocalDateTime.now().toString());
        send(notificationTopic, userId, notification);
    }

    public void publishRateLimitBlock(String cpf) {
        Map<String, Object> event = event("RATE_LIMIT_BLOCK", null, cpf);
        event.put("reason", "MAX_FAILED_ATTEMPTS_EXCEEDED");
        send(authEventsTopic, cpf, event);
        sendAudit("RATE_LIMIT_BLOCK", null, cpf, "MAX_FAILED_ATTEMPTS_EXCEEDED");
    }

    private void sendAudit(String eventType, String userId, String cpf, String reason) {
        Map<String, Object> audit = new HashMap<>();
        audit.put("event", eventType);
        audit.put("service", "auth-service");
        audit.put("userId", userId);
        audit.put("cpf", cpf != null && cpf.length() > 3 ? "***." + cpf.substring(cpf.length() - 3) : cpf);
        audit.put("reason", reason);
        audit.put("timestamp", LocalDateTime.now().toString());
        String key = userId != null ? userId : cpf;
        send(auditLogTopic, key, audit);
    }

    private void send(String topic, String key, Map<String, Object> payload) {
        try {
            kafkaTemplate.send(topic, key, payload);
        } catch (Exception e) {
            log.error("[AuthEventPublisher] Failed to publish to {}: {}", topic, e.getMessage());
        }
    }

    private Map<String, Object> event(String type, String userId, String cpf) {
        Map<String, Object> e = new HashMap<>();
        e.put("eventType", type);
        e.put("userId", userId);
        e.put("cpf", cpf);
        e.put("timestamp", LocalDateTime.now().toString());
        e.put("service", "auth-service");
        return e;
    }
}
