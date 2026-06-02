package com.dogbank.notification.service;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.springframework.stereotype.Service;

@Service
public class NotificationService {

    private static final Logger logger = LogManager.getLogger(NotificationService.class);

    private final Counter pushCounter;
    private final Counter emailCounter;
    private final Counter smsCounter;

    public NotificationService(MeterRegistry meterRegistry) {
        this.pushCounter  = Counter.builder("notifications.dispatched").tag("channel", "push").register(meterRegistry);
        this.emailCounter = Counter.builder("notifications.dispatched").tag("channel", "email").register(meterRegistry);
        this.smsCounter   = Counter.builder("notifications.dispatched").tag("channel", "sms").register(meterRegistry);
    }

    public void sendPush(String userId, String type, String message, String transactionId) {
        logger.info("[PUSH] userId={} type={} txId={} message=\"{}\"", userId, type, transactionId, message);
        pushCounter.increment();
    }

    public void sendEmail(String userId, String type, String message, String transactionId) {
        logger.info("[EMAIL] userId={} type={} txId={} message=\"{}\"", userId, type, transactionId, message);
        emailCounter.increment();
    }

    public void sendSms(String userId, String type, String message) {
        logger.info("[SMS] userId={} type={} message=\"{}\"", userId, type, message);
        smsCounter.increment();
    }

    // Legacy REST endpoint support
    public String sendNotification(String message) {
        logger.info("[HTTP] Sending notification: {}", message);
        sendPush("system", "MANUAL", message, null);
        return "Notificação enviada: " + message;
    }
}
