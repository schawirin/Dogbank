package com.dogbank.notification.service;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.springframework.stereotype.Service;

@Service
public class NotificationService {
    private static final Logger logger = LogManager.getLogger(NotificationService.class);

    /**
     * Simula o envio de uma notificação.
     *
     * @param message mensagem a ser notificada
     * @return uma mensagem informando o status da notificação
     */
    public String sendNotification(String message) {
        // Aqui você pode integrar com um serviço de envio real (e-mail, SMS, etc.)
        logger.info("Enviando notificação: {}", message);
        return "Notificação enviada: " + message;
    }
}
