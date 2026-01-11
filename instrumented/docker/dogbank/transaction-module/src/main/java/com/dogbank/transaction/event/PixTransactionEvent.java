package com.dogbank.transaction.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Event sent to Kafka when a PIX transaction is initiated
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PixTransactionEvent {
    
    private String transactionId;
    private String sourceAccountId;
    private String destinationPixKey;
    private BigDecimal amount;
    private String description;
    private LocalDateTime createdAt;
    private String status;
    private int retryCount;
    private String correlationId;
    
    // User info for notifications
    private String sourceUserName;
    private String sourceUserEmail;
    private String destinationUserName;
    private String destinationUserEmail;
}
