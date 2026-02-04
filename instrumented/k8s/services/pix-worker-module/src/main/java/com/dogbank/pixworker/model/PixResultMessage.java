package com.dogbank.pixworker.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PixResultMessage {
    
    private String transactionId;
    private String correlationId;
    private String status; // COMPLETED, FAILED, REJECTED
    private String message;
    private String bancoCentralCode;
    private LocalDateTime processedAt;
    
    // For notifications
    private String sourceUserEmail;
    private String destinationUserEmail;
    private String amount;
}
