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
public class FraudAnalysisResult {
    private String transactionId;
    private boolean isFraudulent;
    private double riskScore;  // 0.0 to 1.0
    private String riskLevel;  // LOW, MEDIUM, HIGH, CRITICAL
    private List<String> riskFactors;
    private LocalDateTime analyzedAt;
    private long processingTimeMs;
    private String decision;  // APPROVED, BLOCKED, MANUAL_REVIEW, MANUAL_REVIEW_COAF
    private boolean requiresCoafNotification;  // True if transaction >= R$ 50,000.00
}
