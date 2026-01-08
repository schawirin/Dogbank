package com.dogbank.notification.controller;

import com.dogbank.notification.service.NotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    @Autowired
    private NotificationService notificationService;

    /**
     * Endpoint para simular o envio de uma notificação.
     *
     * Exemplo de uso:
     * curl -X POST "http://localhost:8080/api/notifications?message=Olá+DogBank"
     */
    @PostMapping
    public String sendNotification(@RequestParam String message) {
        return notificationService.sendNotification(message);
    }
}
