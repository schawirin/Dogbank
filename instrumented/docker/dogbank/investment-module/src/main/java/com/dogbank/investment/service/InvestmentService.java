package com.dogbank.investment.service;

import com.dogbank.investment.dto.InvestmentPositionResponse;
import com.dogbank.investment.dto.InvestmentProductResponse;
import com.dogbank.investment.dto.InvestmentSubscriptionRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

@Service
public class InvestmentService {

    private static final Logger log = LoggerFactory.getLogger(InvestmentService.class);
    private static final ZoneId SAO_PAULO = ZoneId.of("America/Sao_Paulo");
    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");

    private final Clock clock = Clock.system(SAO_PAULO);
    private final AtomicLong sequence = new AtomicLong(1000);
    private final Map<String, ProductDefinition> products = new LinkedHashMap<>();
    private final Map<String, Position> positions = new ConcurrentHashMap<>();
    private final BigDecimal cdiAnnualRate;
    private final BigDecimal cdiDailyRate;
    private final BigDecimal btcReferencePrice;
    private final BigDecimal driftThresholdPercent;

    public InvestmentService(
        @Value("${investment.cdi.annual-rate}") BigDecimal cdiAnnualRate,
        @Value("${investment.cdi.daily-rate}") BigDecimal cdiDailyRate,
        @Value("${investment.btc.price-brl}") BigDecimal btcReferencePrice,
        @Value("${investment.drift.threshold-percent}") BigDecimal driftThresholdPercent
    ) {
        this.cdiAnnualRate = cdiAnnualRate;
        this.cdiDailyRate = cdiDailyRate;
        this.btcReferencePrice = btcReferencePrice;
        this.driftThresholdPercent = driftThresholdPercent;

        products.put("CDI_100", new ProductDefinition(
            "CDI_100",
            "100% CDI",
            "Renda fixa pos-fixada com rendimento diario simulado.",
            "Baixo",
            cdiAnnualRate,
            cdiDailyRate,
            null,
            "dogbank-cdi-feed",
            List.of("100% CDI", "renda fixa", "auditoria")
        ));
        products.put("BTC", new ProductDefinition(
            "BTC",
            "Bitcoin",
            "Exposicao demo a Bitcoin com cotacao em BRL.",
            "Alto",
            null,
            null,
            btcReferencePrice,
            "dogbank-crypto-feed",
            List.of("cripto", "cotacao", "drift")
        ));
    }

    @PostConstruct
    public void seedDemoPositions() {
        Position cdi = createPosition(
            1L,
            "12345678915",
            "Vitoria Itadori",
            "CDI_100",
            new BigDecimal("1000000.00"),
            "relationship-manager",
            true
        );
        cdi.contractedAt = Instant.now(clock).minus(3, ChronoUnit.DAYS);
        cdi.lastSyncedAt = Instant.now(clock).minus(2, ChronoUnit.DAYS);
        cdi.currentValue = new BigDecimal("1000000.00");
        cdi.status = "DRIFT";
        cdi.syncReason = "SYNC_JOB_LAG";
        positions.put(cdi.positionId, cdi);

        Position btc = createPosition(
            1L,
            "12345678915",
            "Vitoria Itadori",
            "BTC",
            new BigDecimal("50000.00"),
            "mobile-app",
            true
        );
        btc.contractedAt = Instant.now(clock).minus(1, ChronoUnit.DAYS);
        btc.lastSyncedAt = Instant.now(clock).minus(6, ChronoUnit.HOURS);
        btc.currentValue = new BigDecimal("49150.00");
        btc.status = "DRIFT";
        btc.syncReason = "QUOTE_PROVIDER_STALE";
        positions.put(btc.positionId, btc);
    }

    public List<InvestmentProductResponse> listProducts() {
        String now = Instant.now(clock).toString();
        return products.values().stream()
            .map(product -> toProductResponse(product, now))
            .collect(Collectors.toList());
    }

    public List<InvestmentPositionResponse> listPositions(Long accountId) {
        return positions.values().stream()
            .filter(position -> position.accountId.equals(accountId))
            .sorted(Comparator.comparing((Position position) -> position.contractedAt).reversed())
            .map(this::toPositionResponseWithAudit)
            .collect(Collectors.toList());
    }

    public InvestmentPositionResponse subscribe(InvestmentSubscriptionRequest request) {
        validateSubscription(request);
        Position position = createPosition(
            request.accountId,
            request.cpf,
            request.userName,
            request.productCode,
            request.amount,
            valueOrDefault(request.requestedBy, "mobile-app"),
            false
        );
        positions.put(position.positionId, position);

        ProductDefinition product = products.get(position.productCode);
        BigDecimal expectedValue = expectedValue(position);
        BigDecimal driftAmount = expectedValue.subtract(position.currentValue).setScale(2, RoundingMode.HALF_UP);

        log.info(
            "INVESTMENT_CONTRACTED account_id={} cpf={} user_name={} position_id={} product={} amount={} reference_rate={} reference_price={} contracted_by={} audit_correlation_id={}",
            position.accountId,
            position.cpf,
            position.userName,
            position.positionId,
            position.productCode,
            position.principalAmount,
            product.annualRate,
            product.referencePrice,
            position.contractedBy,
            position.auditCorrelationId
        );

        if ("DRIFT".equals(position.status)) {
            log.warn(
                "INVESTMENT_DRIFT_DETECTED account_id={} position_id={} product={} expected_value={} booked_value={} drift_amount={} reason={} audit_correlation_id={}",
                position.accountId,
                position.positionId,
                position.productCode,
                expectedValue,
                position.currentValue,
                driftAmount,
                position.syncReason,
                position.auditCorrelationId
            );
        }

        return toPositionResponse(position);
    }

    public InvestmentPositionResponse syncPosition(String positionId) {
        Position position = requirePosition(positionId);

        if ("BTC".equals(position.productCode) && position.syncAttempts == 0) {
            position.syncAttempts++;
            position.status = "DRIFT";
            position.syncReason = "QUOTE_PROVIDER_STALE";
            BigDecimal expectedValue = expectedValue(position);
            BigDecimal driftAmount = expectedValue.subtract(position.currentValue).setScale(2, RoundingMode.HALF_UP);

            log.error(
                "INVESTMENT_SYNC_FAILED account_id={} position_id={} product={} expected_value={} booked_value={} drift_amount={} reason={} audit_correlation_id={}",
                position.accountId,
                position.positionId,
                position.productCode,
                expectedValue,
                position.currentValue,
                driftAmount,
                position.syncReason,
                position.auditCorrelationId
            );
            throw new SyncFailureException("INVESTMENT_QUOTE_STALE", "Cotacao Bitcoin desatualizada no provedor de precos.");
        }

        position.currentValue = expectedValue(position);
        position.lastSyncedAt = Instant.now(clock);
        position.status = "SYNCED";
        position.syncReason = "SYNC_OK";
        position.syncAttempts++;

        log.info(
            "INVESTMENT_SYNC_SUCCESS account_id={} position_id={} product={} synced_value={} sync_attempts={} audit_correlation_id={}",
            position.accountId,
            position.positionId,
            position.productCode,
            position.currentValue,
            position.syncAttempts,
            position.auditCorrelationId
        );

        return toPositionResponse(position);
    }

    public List<InvestmentPositionResponse> runSync() {
        List<InvestmentPositionResponse> synced = new ArrayList<>();
        for (Position position : positions.values()) {
            if (!"DRIFT".equals(position.status)) {
                continue;
            }
            try {
                synced.add(syncPosition(position.positionId));
            } catch (SyncFailureException ignored) {
                synced.add(toPositionResponse(position));
            }
        }
        return synced;
    }

    private Position createPosition(
        Long accountId,
        String cpf,
        String userName,
        String productCode,
        BigDecimal amount,
        String requestedBy,
        boolean seed
    ) {
        ProductDefinition product = requireProduct(productCode);
        Position position = new Position();
        position.positionId = "DBI-" + sequence.incrementAndGet();
        position.accountId = accountId;
        position.cpf = valueOrDefault(cpf, "unknown");
        position.userName = valueOrDefault(userName, "Cliente DogBank");
        position.productCode = product.code;
        position.principalAmount = money(amount);
        position.contractedBy = requestedBy;
        position.contractedAt = Instant.now(clock);
        position.lastSyncedAt = Instant.now(clock);
        position.auditCorrelationId = UUID.randomUUID().toString();
        position.syncAttempts = 0;

        if ("BTC".equals(product.code)) {
            position.units = position.principalAmount.divide(btcReferencePrice, 8, RoundingMode.HALF_UP);
            position.currentValue = seed
                ? position.principalAmount.multiply(new BigDecimal("0.9830")).setScale(2, RoundingMode.HALF_UP)
                : position.principalAmount.multiply(new BigDecimal("0.9725")).setScale(2, RoundingMode.HALF_UP);
            position.status = "DRIFT";
            position.syncReason = "QUOTE_PROVIDER_STALE";
            return position;
        }

        position.units = BigDecimal.ZERO;
        position.currentValue = seed
            ? position.principalAmount
            : expectedValue(position);
        position.status = seed ? "DRIFT" : "SYNCED";
        position.syncReason = seed ? "SYNC_JOB_LAG" : "SYNC_OK";
        return position;
    }

    private InvestmentProductResponse toProductResponse(ProductDefinition product, String updatedAt) {
        InvestmentProductResponse response = new InvestmentProductResponse();
        response.code = product.code;
        response.name = product.name;
        response.description = product.description;
        response.riskLevel = product.riskLevel;
        response.annualRate = product.annualRate;
        response.dailyRate = product.dailyRate;
        response.referencePrice = product.referencePrice;
        response.quoteSource = product.quoteSource;
        response.updatedAt = updatedAt;
        response.tags = product.tags;
        return response;
    }

    private InvestmentPositionResponse toPositionResponseWithAudit(Position position) {
        InvestmentPositionResponse response = toPositionResponse(position);
        if ("DRIFT".equals(response.status)) {
            log.warn(
                "INVESTMENT_DRIFT_DETECTED account_id={} position_id={} product={} expected_value={} booked_value={} drift_amount={} drift_percent={} reason={} audit_correlation_id={}",
                response.accountId,
                response.positionId,
                response.productCode,
                response.expectedValue,
                response.currentValue,
                response.driftAmount,
                response.driftPercent,
                response.syncReason,
                response.auditCorrelationId
            );
        }
        return response;
    }

    private InvestmentPositionResponse toPositionResponse(Position position) {
        ProductDefinition product = requireProduct(position.productCode);
        BigDecimal expectedValue = expectedValue(position);
        BigDecimal driftAmount = expectedValue.subtract(position.currentValue).setScale(2, RoundingMode.HALF_UP);
        BigDecimal driftPercent = expectedValue.compareTo(BigDecimal.ZERO) == 0
            ? BigDecimal.ZERO
            : driftAmount.divide(expectedValue, 6, RoundingMode.HALF_UP)
                .multiply(ONE_HUNDRED)
                .setScale(2, RoundingMode.HALF_UP);

        if (driftPercent.abs().compareTo(driftThresholdPercent) >= 0 && !"SYNCED".equals(position.status)) {
            position.status = "DRIFT";
        }

        InvestmentPositionResponse response = new InvestmentPositionResponse();
        response.positionId = position.positionId;
        response.accountId = position.accountId;
        response.productCode = position.productCode;
        response.productName = product.name;
        response.status = position.status;
        response.principalAmount = position.principalAmount;
        response.currentValue = position.currentValue;
        response.expectedValue = expectedValue;
        response.driftAmount = driftAmount;
        response.driftPercent = driftPercent;
        response.units = position.units;
        response.annualRate = product.annualRate;
        response.referencePrice = product.referencePrice;
        response.contractedBy = position.contractedBy;
        response.contractedAt = position.contractedAt.toString();
        response.lastSyncedAt = position.lastSyncedAt.toString();
        response.nextSyncAt = position.lastSyncedAt.plus(30, ChronoUnit.MINUTES).toString();
        response.auditCorrelationId = position.auditCorrelationId;
        response.syncReason = position.syncReason;
        response.message = messageFor(position, driftAmount);
        return response;
    }

    private BigDecimal expectedValue(Position position) {
        if ("BTC".equals(position.productCode)) {
            BigDecimal demoPrice = btcReferencePrice.multiply(new BigDecimal("1.0215")).setScale(2, RoundingMode.HALF_UP);
            return position.units.multiply(demoPrice).setScale(2, RoundingMode.HALF_UP);
        }

        long days = Math.max(1, ChronoUnit.DAYS.between(
            LocalDate.ofInstant(position.contractedAt, SAO_PAULO),
            LocalDate.now(clock)
        ) + 1);
        BigDecimal factor = BigDecimal.ONE.add(cdiDailyRate.multiply(new BigDecimal(days)));
        return position.principalAmount.multiply(factor).setScale(2, RoundingMode.HALF_UP);
    }

    private String messageFor(Position position, BigDecimal driftAmount) {
        if ("SYNCED".equals(position.status)) {
            return "Valor sincronizado com o feed de investimentos.";
        }
        return "Valor contabilizado difere do esperado em R$ " + driftAmount.abs().setScale(2, RoundingMode.HALF_UP);
    }

    private void validateSubscription(InvestmentSubscriptionRequest request) {
        if (request == null || request.accountId == null) {
            throw new IllegalArgumentException("accountId e obrigatorio");
        }
        if (request.productCode == null || !products.containsKey(request.productCode)) {
            throw new IllegalArgumentException("Produto de investimento invalido");
        }
        if (request.amount == null || request.amount.compareTo(new BigDecimal("1.00")) < 0) {
            throw new IllegalArgumentException("Valor minimo de investimento e R$ 1,00");
        }
    }

    private ProductDefinition requireProduct(String productCode) {
        ProductDefinition product = products.get(productCode);
        if (product == null) {
            throw new IllegalArgumentException("Produto de investimento invalido: " + productCode);
        }
        return product;
    }

    private Position requirePosition(String positionId) {
        Position position = positions.get(positionId);
        if (position == null) {
            throw new IllegalArgumentException("Investimento nao encontrado: " + positionId);
        }
        return position;
    }

    private BigDecimal money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private String valueOrDefault(String value, String defaultValue) {
        if (value == null || value.trim().isEmpty()) {
            return defaultValue;
        }
        return value.trim();
    }

    private static class ProductDefinition {
        final String code;
        final String name;
        final String description;
        final String riskLevel;
        final BigDecimal annualRate;
        final BigDecimal dailyRate;
        final BigDecimal referencePrice;
        final String quoteSource;
        final List<String> tags;

        ProductDefinition(
            String code,
            String name,
            String description,
            String riskLevel,
            BigDecimal annualRate,
            BigDecimal dailyRate,
            BigDecimal referencePrice,
            String quoteSource,
            List<String> tags
        ) {
            this.code = code;
            this.name = name;
            this.description = description;
            this.riskLevel = riskLevel;
            this.annualRate = annualRate;
            this.dailyRate = dailyRate;
            this.referencePrice = referencePrice;
            this.quoteSource = quoteSource;
            this.tags = tags;
        }
    }

    private static class Position {
        String positionId;
        Long accountId;
        String cpf;
        String userName;
        String productCode;
        BigDecimal principalAmount;
        BigDecimal currentValue;
        BigDecimal units;
        String status;
        String contractedBy;
        Instant contractedAt;
        Instant lastSyncedAt;
        String nextSyncAt;
        String auditCorrelationId;
        String syncReason;
        int syncAttempts;
    }

    public static class SyncFailureException extends RuntimeException {
        public final String errorCode;

        public SyncFailureException(String errorCode, String message) {
            super(message);
            this.errorCode = errorCode;
        }
    }
}
