package com.dogbank.fraud.service;

import com.dogbank.fraud.model.FraudAnalysisResult;
import com.dogbank.fraud.model.PixTransaction;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Fraud Detection Service - Simulates ML-based fraud analysis
 * 
 * Includes COAF (Conselho de Controle de Atividades Financeiras) notification
 * for transactions >= R$ 50,000.00 as required by Brazilian regulations.
 * 
 * In a real system, this would:
 * - Call ML models (TensorFlow, PyTorch)
 * - Check transaction patterns
 * - Verify device fingerprints
 * - Cross-reference with fraud databases
 * - Report to COAF via SISCOAF system
 */
@Slf4j
@Service
public class FraudDetectionService {

    private final RabbitTemplate rabbitTemplate;
    private final Counter fraudDetectedCounter;
    private final Counter transactionsAnalyzedCounter;
    private final Counter coafNotificationsCounter;
    private final Timer analysisTimer;
    private final Random random = new Random();

    // Simulated blacklist
    private static final List<String> BLACKLISTED_KEYS = List.of(
        "hacker@fraud.com",
        "suspicious@test.com",
        "blocked@dogbank.com"
    );

    // Amount thresholds
    private static final BigDecimal HIGH_RISK_AMOUNT = new BigDecimal("5000");
    private static final BigDecimal CRITICAL_AMOUNT = new BigDecimal("10000");
    
    // COAF threshold - R$ 50,000.00 (Brazilian regulation)
    private static final BigDecimal COAF_THRESHOLD = new BigDecimal("50000");

    @Value("${coaf.exchange:coaf.exchange}")
    private String coafExchange;

    @Value("${coaf.routing-key:coaf.notification}")
    private String coafRoutingKey;

    public FraudDetectionService(MeterRegistry meterRegistry, RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
        
        this.fraudDetectedCounter = Counter.builder("fraud.detected")
            .description("Number of fraudulent transactions detected")
            .tag("service", "fraud-detection")
            .register(meterRegistry);
        
        this.transactionsAnalyzedCounter = Counter.builder("fraud.transactions.analyzed")
            .description("Total transactions analyzed")
            .tag("service", "fraud-detection")
            .register(meterRegistry);
        
        this.coafNotificationsCounter = Counter.builder("coaf.notifications.sent")
            .description("Number of COAF notifications sent for suspicious transactions")
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
            boolean requiresCoafNotification = false;

            // ================================================================
            // RULE 0: COAF Notification - Transactions >= R$ 50,000.00
            // Brazilian regulation requires reporting to COAF
            // ================================================================
            if (transaction.getAmount().compareTo(COAF_THRESHOLD) >= 0) {
                requiresCoafNotification = true;
                riskFactors.add("COAF_THRESHOLD_EXCEEDED");
                riskScore += 0.3;
                
                // Log with special marker for compliance audit
                log.warn("🚨 [COAF] TRANSAÇÃO SUSPEITA DETECTADA - Valor >= R$ 50.000,00");
                log.warn("🚨 [COAF] Transaction ID: {}", transaction.getTransactionId());
                log.warn("🚨 [COAF] Valor: R$ {}", transaction.getAmount());
                log.warn("🚨 [COAF] Origem: {} (CPF: {})", 
                    transaction.getSourceAccountId(), 
                    maskCpf(transaction.getSourceCpf()));
                log.warn("🚨 [COAF] Destino: {}", transaction.getDestinationPixKey());
                log.warn("🚨 [COAF] Data/Hora: {}", 
                    LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")));
                
                // Send notification to COAF queue
                sendCoafNotification(transaction);
            }

            // Rule 1: Check blacklist
            if (BLACKLISTED_KEYS.contains(transaction.getDestinationPixKey())) {
                riskFactors.add("DESTINATION_BLACKLISTED");
                riskScore += 0.9;
            }

            // Rule 2: High amount (below COAF threshold)
            if (transaction.getAmount().compareTo(CRITICAL_AMOUNT) > 0 && 
                transaction.getAmount().compareTo(COAF_THRESHOLD) < 0) {
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

            // Rule 7: Round amount (common in money laundering)
            if (isRoundAmount(transaction.getAmount())) {
                riskFactors.add("ROUND_AMOUNT");
                riskScore += 0.1;
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
            } else if (riskScore >= 0.5 || requiresCoafNotification) {
                riskLevel = requiresCoafNotification ? "HIGH" : "MEDIUM";
                decision = requiresCoafNotification ? "MANUAL_REVIEW_COAF" : "MANUAL_REVIEW";
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
                .requiresCoafNotification(requiresCoafNotification)
                .build();

            log.info("🔍 Fraud analysis complete - TX: {}, Amount: R$ {}, Risk: {:.2f} ({}), Decision: {}, COAF: {}, Factors: {}",
                transaction.getTransactionId(),
                transaction.getAmount(),
                riskScore,
                riskLevel,
                decision,
                requiresCoafNotification ? "YES" : "NO",
                riskFactors);

            return result;
        });
    }

    /**
     * Send notification to COAF (Conselho de Controle de Atividades Financeiras)
     * In production, this would integrate with SISCOAF (Sistema de Controle de Atividades Financeiras)
     */
    private void sendCoafNotification(PixTransaction transaction) {
        try {
            Map<String, Object> coafNotification = new HashMap<>();
            coafNotification.put("type", "SUSPICIOUS_TRANSACTION");
            coafNotification.put("transactionId", transaction.getTransactionId());
            coafNotification.put("amount", transaction.getAmount().toString());
            coafNotification.put("currency", "BRL");
            coafNotification.put("sourceAccountId", transaction.getSourceAccountId());
            coafNotification.put("sourceCpf", maskCpf(transaction.getSourceCpf()));
            coafNotification.put("destinationPixKey", transaction.getDestinationPixKey());
            coafNotification.put("timestamp", LocalDateTime.now().toString());
            coafNotification.put("reason", "TRANSACTION_ABOVE_50K_THRESHOLD");
            coafNotification.put("institutionCode", "DOGBANK");
            coafNotification.put("institutionCnpj", "00.000.000/0001-00");
            
            // Send to RabbitMQ COAF queue
            rabbitTemplate.convertAndSend(coafExchange, coafRoutingKey, coafNotification);
            
            coafNotificationsCounter.increment();
            
            log.info("📤 [COAF] Notificação enviada para fila COAF - TX: {}, Valor: R$ {}",
                transaction.getTransactionId(),
                transaction.getAmount());
                
        } catch (Exception e) {
            log.error("❌ [COAF] Erro ao enviar notificação COAF - TX: {}: {}",
                transaction.getTransactionId(),
                e.getMessage());
        }
    }

    /**
     * Mask CPF for logging (show only last 4 digits)
     */
    private String maskCpf(String cpf) {
        if (cpf == null || cpf.length() < 4) {
            return "***";
        }
        return "***.***.***-" + cpf.substring(cpf.length() - 2);
    }

    /**
     * Check if amount is a round number (common in money laundering)
     */
    private boolean isRoundAmount(BigDecimal amount) {
        // Check if amount is divisible by 1000 and >= 10000
        return amount.compareTo(new BigDecimal("10000")) >= 0 &&
               amount.remainder(new BigDecimal("1000")).compareTo(BigDecimal.ZERO) == 0;
    }
}
