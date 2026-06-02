package com.dogbank.fraud.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FraudEvent {
    private String transactionId;
    private String correlationId;
    private String decision;          // APPROVED, BLOCKED, MANUAL_REVIEW, MANUAL_REVIEW_COAF
    private String riskLevel;         // LOW, MEDIUM, HIGH, CRITICAL
    private double riskScore;
    private boolean fraudulent;
    private boolean requiresCoafReport;
    private List<String> riskFactors;
    private long processingTimeMs;
    private LocalDateTime analyzedAt;
    private String sourceAccountId;
    private String destinationPixKey;
    private String amountBrl;
}
