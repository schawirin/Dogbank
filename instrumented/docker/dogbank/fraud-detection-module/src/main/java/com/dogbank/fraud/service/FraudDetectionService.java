package com.dogbank.fraud.service;

import com.dogbank.fraud.model.FraudAnalysisResult;
import com.dogbank.fraud.model.PixTransaction;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/**
 * Fraud Detection Service - Simulates ML-based fraud analysis
 * 
 * In a real system, this would:
 * - Call ML models (TensorFlow, PyTorch)
 * - Check transaction patterns
 * - Verify device fingerprints
 * - Cross-reference with fraud databases
 */
@Slf4j
@Service
public class FraudDetectionService {

    private final Counter fraudDetectedCounter;
    private final Counter transactionsAnalyzedCounter;
    private final Timer analysisTimer;
    private final Random random = new Random();

    // Simulated blacklist
    private static final List<String> BLACKLISTED_KEYS = List.of(
        "hacker@fraud.com",
        "suspicious@test.com",
        "blocked@dogbank.com"
    );

    // High-risk amount threshold
    private static final BigDecimal HIGH_RISK_AMOUNT = new BigDecimal("5000");
    private static final BigDecimal CRITICAL_AMOUNT = new BigDecimal("10000");

    public FraudDetectionService(MeterRegistry meterRegistry) {
        this.fraudDetectedCounter = Counter.builder("fraud.detected")
            .description("Number of fraudulent transactions detected")
            .tag("service", "fraud-detection")
            .register(meterRegistry);
        
        this.transactionsAnalyzedCounter = Counter.builder("fraud.transactions.analyzed")
            .description("Total transactions analyzed")
            .tag("service", "fraud-detection")
            .register(meterRegistry);
        
        this.analysisTimer = Timer.builder("fraud.analysis.time")
            .description("Time to analyze transaction for fraud")
            .tag("service", "fraud-detection")
            .register(meterRegistry);
    }

    public FraudAnalysisResult analyzeTransaction(PixTransaction transaction) {
        long startTime = System.currentTimeMillis();
        
        return analysisTimer.record(() -> {
            transactionsAnalyzedCounter.increment();
            
            List<String> riskFactors = new ArrayList<>();
            double riskScore = 0.0;

            // Rule 1: Check blacklist
            if (BLACKLISTED_KEYS.contains(transaction.getDestinationPixKey())) {
                riskFactors.add("DESTINATION_BLACKLISTED");
                riskScore += 0.9;
            }

            // Rule 2: High amount
            if (transaction.getAmount().compareTo(CRITICAL_AMOUNT) > 0) {
                riskFactors.add("CRITICAL_AMOUNT_EXCEEDED");
                riskScore += 0.4;
            } else if (transaction.getAmount().compareTo(HIGH_RISK_AMOUNT) > 0) {
                riskFactors.add("HIGH_AMOUNT");
                riskScore += 0.2;
            }

            // Rule 3: Unusual time (between 2 AM and 5 AM)
            LocalTime now = LocalTime.now();
            if (now.isAfter(LocalTime.of(2, 0)) && now.isBefore(LocalTime.of(5, 0))) {
                riskFactors.add("UNUSUAL_TIME");
                riskScore += 0.15;
            }

            // Rule 4: New recipient (simulated - 10% chance)
            if (random.nextDouble() < 0.1) {
                riskFactors.add("NEW_RECIPIENT");
                riskScore += 0.1;
            }

            // Rule 5: Velocity check (simulated - 5% chance of multiple transactions)
            if (random.nextDouble() < 0.05) {
                riskFactors.add("HIGH_VELOCITY");
                riskScore += 0.25;
            }

            // Rule 6: Device anomaly (simulated - 3% chance)
            if (random.nextDouble() < 0.03) {
                riskFactors.add("DEVICE_ANOMALY");
                riskScore += 0.3;
            }

            // Normalize score
            riskScore = Math.min(riskScore, 1.0);

            // Determine risk level and decision
            String riskLevel;
            String decision;
            boolean isFraudulent = false;

            if (riskScore >= 0.8) {
                riskLevel = "CRITICAL";
                decision = "BLOCKED";
                isFraudulent = true;
                fraudDetectedCounter.increment();
            } else if (riskScore >= 0.5) {
                riskLevel = "HIGH";
                decision = "MANUAL_REVIEW";
            } else if (riskScore >= 0.3) {
                riskLevel = "MEDIUM";
                decision = "APPROVED";
            } else {
                riskLevel = "LOW";
                decision = "APPROVED";
            }

            long processingTime = System.currentTimeMillis() - startTime;

            // Simulate ML processing time (50-200ms)
            try {
                Thread.sleep(50 + random.nextInt(150));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }

            FraudAnalysisResult result = FraudAnalysisResult.builder()
                .transactionId(transaction.getTransactionId())
                .isFraudulent(isFraudulent)
                .riskScore(riskScore)
                .riskLevel(riskLevel)
                .riskFactors(riskFactors)
                .analyzedAt(LocalDateTime.now())
                .processingTimeMs(processingTime)
                .decision(decision)
                .build();

            log.info("🔍 Fraud analysis complete - TX: {}, Risk: {:.2f} ({}), Decision: {}, Factors: {}",
                transaction.getTransactionId(),
                riskScore,
                riskLevel,
                decision,
                riskFactors);

            return result;
        });
    }
}
