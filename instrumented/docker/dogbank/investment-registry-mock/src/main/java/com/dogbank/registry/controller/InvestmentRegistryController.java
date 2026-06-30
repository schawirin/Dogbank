package com.dogbank.registry.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/investment-registry")
public class InvestmentRegistryController {

    private static final Logger log = LoggerFactory.getLogger(InvestmentRegistryController.class);
    private static final Set<String> SUPPORTED_PRODUCTS = Set.of("CDI_100", "BTC");

    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> registerInvestment(@RequestBody Map<String, Object> request) {
        long start = System.currentTimeMillis();
        String orderId = text(request.get("orderId"));
        String productCode = text(request.get("productCode"));
        BigDecimal amount = decimal(request.get("amount"));
        String cpf = text(request.get("cpf"));

        log.info(
            "INVESTMENT_REGISTRY_REQUEST_RECEIVED order_id={} product={} amount={} cpf={} participant=DOGBANK-DTVM",
            orderId,
            productCode,
            amount,
            maskDocument(cpf)
        );

        simulateLatency();

        if (!SUPPORTED_PRODUCTS.contains(productCode)) {
            return failed("REGISTRY_PRODUCT_NOT_SUPPORTED", "Produto nao elegivel para registro", HttpStatus.BAD_REQUEST, start);
        }

        if (amount.compareTo(new BigDecimal("77777.00")) == 0) {
            simulateLongDelay();
            return failed("REGISTRY_TIMEOUT", "Timeout ao registrar aplicacao no depositario", HttpStatus.REQUEST_TIMEOUT, start);
        }

        if (amount.compareTo(new BigDecimal("5000000.00")) > 0) {
            return failed("SUITABILITY_REVIEW_REQUIRED", "Aporte exige revisao de suitability", HttpStatus.UNPROCESSABLE_ENTITY, start);
        }

        String registryVenue = "BTC".equals(productCode)
            ? "MATERA-CORE-BANKING"
            : "B3-CENTRAL-DEPOSITARIA";
        String registryId = ("BTC".equals(productCode) ? "MTR-" : "B3-") + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        String protocol = "REG-" + Instant.now().toEpochMilli() + "-" + registryId.substring(0, 3);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "REGISTERED");
        response.put("registryId", registryId);
        response.put("registryProtocol", protocol);
        response.put("registryVenue", registryVenue);
        response.put("participantCode", "DOGBANK-DTVM");
        response.put("registeredAt", Instant.now().toString());
        response.put("settlementStatus", "BOOKED");
        response.put("processingTimeMs", System.currentTimeMillis() - start);

        log.info(
            "INVESTMENT_REGISTRY_REGISTERED order_id={} product={} registry_id={} protocol={} venue={} settlement_status=BOOKED duration_ms={}",
            orderId,
            productCode,
            registryId,
            protocol,
            registryVenue,
            System.currentTimeMillis() - start
        );

        return ResponseEntity.ok(response);
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of(
            "status", "UP",
            "service", "b3-investment-registry",
            "timestamp", Instant.now().toString()
        ));
    }

    private ResponseEntity<Map<String, Object>> failed(String code, String message, HttpStatus status, long start) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "FAILED");
        response.put("errorCode", code);
        response.put("message", message);
        response.put("processingTimeMs", System.currentTimeMillis() - start);

        log.error(
            "INVESTMENT_REGISTRY_FAILED error_code={} message=\"{}\" duration_ms={}",
            code,
            message,
            System.currentTimeMillis() - start
        );

        return ResponseEntity.status(status).body(response);
    }

    private BigDecimal decimal(Object value) {
        if (value instanceof Number) {
            return new BigDecimal(value.toString()).setScale(2, RoundingMode.HALF_UP);
        }
        if (value == null) {
            return BigDecimal.ZERO.setScale(2);
        }
        return new BigDecimal(String.valueOf(value)).setScale(2, RoundingMode.HALF_UP);
    }

    private String text(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private String maskDocument(String value) {
        if (value == null || value.length() < 5) {
            return "***";
        }
        return value.substring(0, 3) + "*****" + value.substring(value.length() - 2);
    }

    private void simulateLatency() {
        try {
            Thread.sleep(80);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private void simulateLongDelay() {
        try {
            Thread.sleep(4000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
