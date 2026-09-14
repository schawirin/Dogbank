package com.dogbank.investment.service;

import com.dogbank.investment.dto.InvestmentPositionResponse;
import com.dogbank.investment.dto.InvestmentProductResponse;
import com.dogbank.investment.dto.InvestmentSubscriptionRequest;
import com.dogbank.investment.entity.InvestmentPosition;
import com.dogbank.investment.repository.InvestmentPositionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

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
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

@Service
public class InvestmentService {

    private static final Logger auditLog = LoggerFactory.getLogger("investment.audit");
    private static final ZoneId SAO_PAULO = ZoneId.of("America/Sao_Paulo");
    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");

    private final Clock clock = Clock.system(SAO_PAULO);
    private final AtomicLong sequence = new AtomicLong(1000);
    private final Map<String, ProductDefinition> products = new LinkedHashMap<>();
    private final InvestmentPositionRepository positionRepository;
    private final BigDecimal cdiAnnualRate;
    private final BigDecimal cdiDailyRate;
    private final BigDecimal btcReferencePrice;
    private final BigDecimal driftThresholdPercent;
    private final RestTemplate restTemplate;
    private final String registryBaseUrl;

    public InvestmentService(
        InvestmentPositionRepository positionRepository,
        RestTemplateBuilder restTemplateBuilder,
        @Value("${investment.cdi.annual-rate}") BigDecimal cdiAnnualRate,
        @Value("${investment.cdi.daily-rate}") BigDecimal cdiDailyRate,
        @Value("${investment.btc.price-brl}") BigDecimal btcReferencePrice,
        @Value("${investment.drift.threshold-percent}") BigDecimal driftThresholdPercent,
        @Value("${investment.registry.base-url}") String registryBaseUrl
    ) {
        this.positionRepository = positionRepository;
        this.restTemplate = restTemplateBuilder.build();
        this.cdiAnnualRate = cdiAnnualRate;
        this.cdiDailyRate = cdiDailyRate;
        this.btcReferencePrice = btcReferencePrice;
        this.driftThresholdPercent = driftThresholdPercent;
        this.registryBaseUrl = registryBaseUrl.replaceAll("/+$", "");

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
            List.of("cripto", "cotacao", "divergencia")
        ));
    }

    @PostConstruct
    @Transactional
    public void seedDemoPositions() {
        alignSequenceWithDatabase();

        if (positionRepository.countByAccountId(1L) > 0) {
            return;
        }

        InvestmentPosition cdi = createPosition(
            1L,
            "12345678915",
            "Vitoria Itadori",
            "CDI_100",
            new BigDecimal("1000000.00"),
            "relationship-manager",
            true
        );
        cdi.setContractedAt(Instant.now(clock).minus(3, ChronoUnit.DAYS));
        cdi.setLastSyncedAt(Instant.now(clock).minus(2, ChronoUnit.DAYS));
        cdi.setCurrentValue(new BigDecimal("1000000.00"));
        cdi.setStatus("DRIFT");
        cdi.setSyncReason("SYNC_JOB_LAG");
        markSeedRegistry(cdi, "B3-CENTRAL-DEPOSITARIA");
        positionRepository.save(cdi);

        InvestmentPosition btc = createPosition(
            1L,
            "12345678915",
            "Vitoria Itadori",
            "BTC",
            new BigDecimal("50000.00"),
            "mobile-app",
            true
        );
        btc.setContractedAt(Instant.now(clock).minus(1, ChronoUnit.DAYS));
        btc.setLastSyncedAt(Instant.now(clock).minus(6, ChronoUnit.HOURS));
        btc.setCurrentValue(new BigDecimal("49150.00"));
        btc.setStatus("DRIFT");
        btc.setSyncReason("QUOTE_PROVIDER_STALE");
        markSeedRegistry(btc, "MATERA-CORE-BANKING");
        positionRepository.save(btc);
    }

    public List<InvestmentProductResponse> listProducts() {
        String now = Instant.now(clock).toString();
        return products.values().stream()
            .map(product -> toProductResponse(product, now))
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<InvestmentPositionResponse> listPositions(Long accountId) {
        return positionRepository.findByAccountIdOrderByContractedAtDesc(accountId).stream()
            .map(this::toPositionResponseWithAudit)
            .collect(Collectors.toList());
    }

    @Transactional
    public InvestmentPositionResponse subscribe(InvestmentSubscriptionRequest request) {
        validateSubscription(request);
        InvestmentPosition position = createPosition(
            request.accountId,
            request.cpf,
            request.userName,
            request.productCode,
            request.amount,
            valueOrDefault(request.requestedBy, "mobile-app"),
            false
        );
        registerWithExternalDepositary(position);
        InvestmentPosition saved = positionRepository.save(position);

        ProductDefinition product = products.get(saved.getProductCode());
        BigDecimal expectedValue = expectedValue(saved);
        BigDecimal driftAmount = expectedValue.subtract(saved.getCurrentValue()).setScale(2, RoundingMode.HALF_UP);

        try {
            putInvestmentAuditContext("investment.contracted", saved, product);
            putMdc("investment.expected_value", expectedValue);
            putMdc("expected_value", expectedValue);
            putMdc("drift.amount", driftAmount);
            putMdc("drift_amount", driftAmount);
            auditLog.info("INVESTMENT_CONTRACTED");
        } finally {
            clearInvestmentAuditContext();
        }

        if ("DRIFT".equals(saved.getStatus())) {
            try {
                putInvestmentAuditContext("investment.drift_detected", saved, product);
                putMdc("investment.expected_value", expectedValue);
                putMdc("expected_value", expectedValue);
                putMdc("drift.amount", driftAmount);
                putMdc("drift_amount", driftAmount);
                auditLog.warn("INVESTMENT_DRIFT_DETECTED");
            } finally {
                clearInvestmentAuditContext();
            }
        }

        return toPositionResponse(saved);
    }

    @Transactional
    public InvestmentPositionResponse syncPosition(String positionId) {
        InvestmentPosition position = requirePosition(positionId);

        if ("BTC".equals(position.getProductCode()) && position.getSyncAttempts() == 0) {
            position.setSyncAttempts(position.getSyncAttempts() + 1);
            position.setStatus("DRIFT");
            position.setSyncReason("QUOTE_PROVIDER_STALE");
            positionRepository.save(position);

            BigDecimal expectedValue = expectedValue(position);
            BigDecimal driftAmount = expectedValue.subtract(position.getCurrentValue()).setScale(2, RoundingMode.HALF_UP);

            try {
                putInvestmentAuditContext("investment.sync_failed", position, requireProduct(position.getProductCode()));
                putMdc("investment.expected_value", expectedValue);
                putMdc("expected_value", expectedValue);
                putMdc("drift.amount", driftAmount);
                putMdc("drift_amount", driftAmount);
                putMdc("error.code", "INVESTMENT_QUOTE_STALE");
                putMdc("error_code", "INVESTMENT_QUOTE_STALE");
                putMdc("error.message", "Cotacao Bitcoin desatualizada no provedor de precos.");
                putMdc("error_message", "Cotacao Bitcoin desatualizada no provedor de precos.");
                auditLog.error("INVESTMENT_SYNC_FAILED");
            } finally {
                clearInvestmentAuditContext();
            }
            throw new SyncFailureException("INVESTMENT_QUOTE_STALE", "Cotacao Bitcoin desatualizada no provedor de precos.");
        }

        position.setCurrentValue(expectedValue(position));
        position.setLastSyncedAt(Instant.now(clock));
        position.setStatus("SYNCED");
        position.setSyncReason("SYNC_OK");
        position.setSyncAttempts(position.getSyncAttempts() + 1);
        InvestmentPosition saved = positionRepository.save(position);

        try {
            putInvestmentAuditContext("investment.sync_success", saved, requireProduct(saved.getProductCode()));
            putMdc("investment.expected_value", saved.getCurrentValue());
            putMdc("expected_value", saved.getCurrentValue());
            putMdc("drift.amount", BigDecimal.ZERO.setScale(2));
            putMdc("drift_amount", BigDecimal.ZERO.setScale(2));
            putMdc("drift.percent", BigDecimal.ZERO.setScale(2));
            putMdc("drift_percent", BigDecimal.ZERO.setScale(2));
            auditLog.info("INVESTMENT_SYNC_SUCCESS");
        } finally {
            clearInvestmentAuditContext();
        }

        return toPositionResponse(saved);
    }

    @Transactional
    public List<InvestmentPositionResponse> runSync() {
        List<InvestmentPositionResponse> synced = new ArrayList<>();
        for (InvestmentPosition position : positionRepository.findAll()) {
            if (!"DRIFT".equals(position.getStatus())) {
                continue;
            }
            try {
                synced.add(syncPosition(position.getPositionId()));
            } catch (SyncFailureException ignored) {
                synced.add(toPositionResponse(position));
            }
        }
        return synced;
    }

    private InvestmentPosition createPosition(
        Long accountId,
        String cpf,
        String userName,
        String productCode,
        BigDecimal amount,
        String requestedBy,
        boolean seed
    ) {
        ProductDefinition product = requireProduct(productCode);
        InvestmentPosition position = new InvestmentPosition();
        position.setPositionId(nextPositionId());
        position.setAccountId(accountId);
        position.setCpf(valueOrDefault(cpf, "unknown"));
        position.setUserName(valueOrDefault(userName, "Cliente DogBank"));
        position.setProductCode(product.code);
        position.setPrincipalAmount(money(amount));
        position.setContractedBy(requestedBy);
        position.setContractedAt(Instant.now(clock));
        position.setLastSyncedAt(Instant.now(clock));
        position.setAuditCorrelationId(UUID.randomUUID().toString());
        position.setSyncAttempts(0);

        if ("BTC".equals(product.code)) {
            position.setUnits(position.getPrincipalAmount().divide(btcReferencePrice, 8, RoundingMode.HALF_UP));
            position.setCurrentValue(seed
                ? position.getPrincipalAmount().multiply(new BigDecimal("0.9830")).setScale(2, RoundingMode.HALF_UP)
                : position.getPrincipalAmount().multiply(new BigDecimal("0.9725")).setScale(2, RoundingMode.HALF_UP));
            position.setStatus("DRIFT");
            position.setSyncReason("QUOTE_PROVIDER_STALE");
            return position;
        }

        position.setUnits(BigDecimal.ZERO);
        position.setCurrentValue(seed ? position.getPrincipalAmount() : expectedValue(position));
        position.setStatus(seed ? "DRIFT" : "SYNCED");
        position.setSyncReason(seed ? "SYNC_JOB_LAG" : "SYNC_OK");
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

    private InvestmentPositionResponse toPositionResponseWithAudit(InvestmentPosition position) {
        InvestmentPositionResponse response = toPositionResponse(position);
        if ("DRIFT".equals(response.status)) {
            try {
                putInvestmentAuditContext("investment.drift_detected", position, requireProduct(position.getProductCode()));
                putMdc("investment.expected_value", response.expectedValue);
                putMdc("expected_value", response.expectedValue);
                putMdc("investment.current_value", response.currentValue);
                putMdc("current_value", response.currentValue);
                putMdc("drift.amount", response.driftAmount);
                putMdc("drift_amount", response.driftAmount);
                putMdc("drift.percent", response.driftPercent);
                putMdc("drift_percent", response.driftPercent);
                auditLog.warn("INVESTMENT_DRIFT_DETECTED");
            } finally {
                clearInvestmentAuditContext();
            }
        }
        return response;
    }

    private InvestmentPositionResponse toPositionResponse(InvestmentPosition position) {
        ProductDefinition product = requireProduct(position.getProductCode());
        BigDecimal expectedValue = expectedValue(position);
        BigDecimal currentValue = money(position.getCurrentValue());
        BigDecimal driftAmount = expectedValue.subtract(currentValue).setScale(2, RoundingMode.HALF_UP);
        BigDecimal driftPercent = expectedValue.compareTo(BigDecimal.ZERO) == 0
            ? BigDecimal.ZERO
            : driftAmount.divide(expectedValue, 6, RoundingMode.HALF_UP)
                .multiply(ONE_HUNDRED)
                .setScale(2, RoundingMode.HALF_UP);

        String status = position.getStatus();
        if (driftPercent.abs().compareTo(driftThresholdPercent) >= 0 && !"SYNCED".equals(status)) {
            status = "DRIFT";
        }

        InvestmentPositionResponse response = new InvestmentPositionResponse();
        response.positionId = position.getPositionId();
        response.accountId = position.getAccountId();
        response.productCode = position.getProductCode();
        response.productName = product.name;
        response.status = status;
        response.principalAmount = position.getPrincipalAmount();
        response.currentValue = currentValue;
        response.expectedValue = expectedValue;
        response.driftAmount = driftAmount;
        response.driftPercent = driftPercent;
        response.units = position.getUnits();
        response.annualRate = product.annualRate;
        response.referencePrice = product.referencePrice;
        response.contractedBy = position.getContractedBy();
        response.contractedAt = position.getContractedAt().toString();
        response.lastSyncedAt = position.getLastSyncedAt().toString();
        response.nextSyncAt = position.getLastSyncedAt().plus(30, ChronoUnit.MINUTES).toString();
        response.auditCorrelationId = position.getAuditCorrelationId();
        response.syncReason = position.getSyncReason();
        response.message = messageFor(status);
        response.registryId = position.getRegistryId();
        response.registryProtocol = position.getRegistryProtocol();
        response.registryVenue = position.getRegistryVenue();
        response.registryStatus = position.getRegistryStatus();
        return response;
    }

    @SuppressWarnings("unchecked")
    private void registerWithExternalDepositary(InvestmentPosition position) {
        String registryOrderId = position.getAuditCorrelationId();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("orderId", registryOrderId);
        payload.put("accountId", position.getAccountId());
        payload.put("cpf", position.getCpf());
        payload.put("userName", position.getUserName());
        payload.put("productCode", position.getProductCode());
        payload.put("amount", position.getPrincipalAmount());
        payload.put("units", position.getUnits());
        payload.put("requestedBy", position.getContractedBy());

        ProductDefinition product = requireProduct(position.getProductCode());
        try {
            putInvestmentAuditContext("investment.registry_call_started", position, product);
            putMdc("registry.order_id", registryOrderId);
            putMdc("registry_order_id", registryOrderId);
            putMdc("registry.status", "STARTED");
            putMdc("registry_status", "STARTED");
            auditLog.info("INVESTMENT_REGISTRY_CALL_STARTED");
        } finally {
            clearInvestmentAuditContext();
        }

        try {
            long registryStart = System.currentTimeMillis();
            ResponseEntity<Map> response = restTemplate.postForEntity(
                registryBaseUrl + "/api/investment-registry/register",
                payload,
                Map.class
            );
            Map<String, Object> body = response.getBody();
            if (body == null || !"REGISTERED".equals(String.valueOf(body.get("status")))) {
                throw new RegistryFailureException("REGISTRY_REJECTED", "Registro externo nao confirmou a aplicacao");
            }

            position.setRegistryId(String.valueOf(body.get("registryId")));
            position.setRegistryProtocol(String.valueOf(body.get("registryProtocol")));
            position.setRegistryVenue(String.valueOf(body.get("registryVenue")));
            position.setRegistryStatus(String.valueOf(body.get("status")));

            try {
                putInvestmentAuditContext("investment.registry_accepted", position, product);
                putMdc("registry.order_id", registryOrderId);
                putMdc("registry_order_id", registryOrderId);
                putMdc("registry.duration_ms", System.currentTimeMillis() - registryStart);
                putMdc("registry_duration_ms", System.currentTimeMillis() - registryStart);
                auditLog.info("INVESTMENT_REGISTRY_ACCEPTED");
            } finally {
                clearInvestmentAuditContext();
            }
        } catch (RegistryFailureException ex) {
            try {
                putInvestmentAuditContext("investment.registry_failed", position, product);
                putMdc("registry.order_id", registryOrderId);
                putMdc("registry_order_id", registryOrderId);
                putMdc("registry.status", "FAILED");
                putMdc("registry_status", "FAILED");
                putMdc("error.code", ex.errorCode);
                putMdc("error_code", ex.errorCode);
                putMdc("error.message", ex.getMessage());
                putMdc("error_message", ex.getMessage());
                auditLog.error("INVESTMENT_REGISTRY_FAILED");
            } finally {
                clearInvestmentAuditContext();
            }
            throw ex;
        } catch (RestClientException ex) {
            try {
                putInvestmentAuditContext("investment.registry_failed", position, product);
                putMdc("registry.order_id", registryOrderId);
                putMdc("registry_order_id", registryOrderId);
                putMdc("registry.status", "FAILED");
                putMdc("registry_status", "FAILED");
                putMdc("error.code", "REGISTRY_UNAVAILABLE");
                putMdc("error_code", "REGISTRY_UNAVAILABLE");
                putMdc("error.message", ex.getMessage());
                putMdc("error_message", ex.getMessage());
                auditLog.error("INVESTMENT_REGISTRY_FAILED", ex);
            } finally {
                clearInvestmentAuditContext();
            }
            throw new RegistryFailureException("REGISTRY_UNAVAILABLE", "Nao foi possivel registrar a aplicacao no depositario externo.", ex);
        }
    }

    private void putInvestmentAuditContext(String eventType, InvestmentPosition position, ProductDefinition product) {
        putMdc("event_type", eventType);
        putMdc("audit.correlation_id", position.getAuditCorrelationId());
        putMdc("audit_correlation_id", position.getAuditCorrelationId());
        putMdc("audit.actor", position.getContractedBy());
        putMdc("audit.channel", position.getContractedBy());
        putMdc("account.id", position.getAccountId());
        putMdc("account_id", position.getAccountId());
        putMdc("cpf", position.getCpf());
        putMdc("customer.name", position.getUserName());
        putMdc("customer.document_masked", maskDocument(position.getCpf()));
        putMdc("cpf_masked", maskDocument(position.getCpf()));
        putMdc("user_name", position.getUserName());
        putMdc("investment.position_id", position.getPositionId());
        putMdc("position_id", position.getPositionId());
        putMdc("investment.product_code", position.getProductCode());
        putMdc("product_code", position.getProductCode());
        putMdc("investment.product_name", product.name);
        putMdc("product_name", product.name);
        putMdc("investment.status", position.getStatus());
        putMdc("investment_status", position.getStatus());
        putMdc("investment.amount", position.getPrincipalAmount());
        putMdc("amount", position.getPrincipalAmount());
        putMdc("investment.current_value", position.getCurrentValue());
        putMdc("current_value", position.getCurrentValue());
        putMdc("investment.units", position.getUnits());
        putMdc("units", position.getUnits());
        putMdc("investment.reference_rate", product.annualRate);
        putMdc("reference_rate", product.annualRate);
        putMdc("investment.reference_price", product.referencePrice);
        putMdc("reference_price", product.referencePrice);
        putMdc("investment.contracted_at", position.getContractedAt());
        putMdc("contracted_at", position.getContractedAt());
        putMdc("contracted_by", position.getContractedBy());
        putMdc("sync.reason", position.getSyncReason());
        putMdc("sync_reason", position.getSyncReason());
        putMdc("sync.attempts", position.getSyncAttempts());
        putMdc("sync_attempts", position.getSyncAttempts());
        putMdc("sync.last_synced_at", position.getLastSyncedAt());
        putMdc("last_synced_at", position.getLastSyncedAt());
        putMdc("registry.id", position.getRegistryId());
        putMdc("registry_id", position.getRegistryId());
        putMdc("registry.protocol", position.getRegistryProtocol());
        putMdc("registry_protocol", position.getRegistryProtocol());
        putMdc("registry.venue", position.getRegistryVenue());
        putMdc("registry_venue", position.getRegistryVenue());
        putMdc("registry.status", position.getRegistryStatus());
        putMdc("registry_status", position.getRegistryStatus());
    }

    private void putMdc(String key, Object value) {
        if (value != null) {
            MDC.put(key, String.valueOf(value));
        }
    }

    private void clearInvestmentAuditContext() {
        List.of(
            "event_type",
            "audit.correlation_id",
            "audit_correlation_id",
            "audit.actor",
            "audit.channel",
            "account.id",
            "account_id",
            "cpf",
            "customer.name",
            "customer.document_masked",
            "cpf_masked",
            "user_name",
            "investment.position_id",
            "position_id",
            "investment.product_code",
            "product_code",
            "investment.product_name",
            "product_name",
            "investment.status",
            "investment_status",
            "investment.amount",
            "amount",
            "investment.current_value",
            "current_value",
            "investment.expected_value",
            "expected_value",
            "investment.units",
            "units",
            "investment.reference_rate",
            "reference_rate",
            "investment.reference_price",
            "reference_price",
            "investment.contracted_at",
            "contracted_at",
            "contracted_by",
            "drift.amount",
            "drift_amount",
            "drift.percent",
            "drift_percent",
            "sync.reason",
            "sync_reason",
            "sync.attempts",
            "sync_attempts",
            "sync.last_synced_at",
            "last_synced_at",
            "registry.order_id",
            "registry_order_id",
            "registry.id",
            "registry_id",
            "registry.protocol",
            "registry_protocol",
            "registry.venue",
            "registry_venue",
            "registry.status",
            "registry_status",
            "registry.duration_ms",
            "registry_duration_ms",
            "error.code",
            "error_code",
            "error.message",
            "error_message"
        ).forEach(MDC::remove);
    }

    private String maskDocument(String value) {
        if (value == null || value.isBlank()) {
            return "***";
        }
        String digits = value.replaceAll("\\D", "");
        if (digits.length() < 5) {
            return "***";
        }
        return digits.substring(0, 3) + "*****" + digits.substring(digits.length() - 2);
    }

    private BigDecimal expectedValue(InvestmentPosition position) {
        if ("BTC".equals(position.getProductCode())) {
            BigDecimal demoPrice = btcReferencePrice.multiply(new BigDecimal("1.0215")).setScale(2, RoundingMode.HALF_UP);
            return position.getUnits().multiply(demoPrice).setScale(2, RoundingMode.HALF_UP);
        }

        long days = Math.max(1, ChronoUnit.DAYS.between(
            LocalDate.ofInstant(position.getContractedAt(), SAO_PAULO),
            LocalDate.now(clock)
        ) + 1);
        BigDecimal factor = BigDecimal.ONE.add(cdiDailyRate.multiply(new BigDecimal(days)));
        return position.getPrincipalAmount().multiply(factor).setScale(2, RoundingMode.HALF_UP);
    }

    private String messageFor(String status) {
        if ("SYNCED".equals(status)) {
            return "Aplicacao atualizada com sucesso.";
        }
        return "Aplicacao registrada e disponivel na carteira.";
    }

    private void markSeedRegistry(InvestmentPosition position, String venue) {
        String prefix = "B3-CENTRAL-DEPOSITARIA".equals(venue) ? "B3-" : "MTR-";
        position.setRegistryId(prefix + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        position.setRegistryProtocol("REG-SEED-" + position.getPositionId());
        position.setRegistryVenue(venue);
        position.setRegistryStatus("REGISTERED");
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

    private InvestmentPosition requirePosition(String positionId) {
        return positionRepository.findByPositionId(positionId)
            .orElseThrow(() -> new IllegalArgumentException("Investimento nao encontrado: " + positionId));
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

    private String nextPositionId() {
        String candidate;
        do {
            candidate = "DBI-" + sequence.incrementAndGet();
        } while (positionRepository.existsByPositionId(candidate));
        return candidate;
    }

    private void alignSequenceWithDatabase() {
        long max = positionRepository.findAll().stream()
            .map(InvestmentPosition::getPositionId)
            .map(this::parsePositionNumber)
            .max(Comparator.naturalOrder())
            .orElse(1000L);
        sequence.set(Math.max(1000L, max));
    }

    private long parsePositionNumber(String positionId) {
        if (positionId == null || !positionId.startsWith("DBI-")) {
            return 1000L;
        }
        try {
            return Long.parseLong(positionId.substring(4));
        } catch (NumberFormatException ignored) {
            return 1000L;
        }
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

    public static class SyncFailureException extends RuntimeException {
        public final String errorCode;

        public SyncFailureException(String errorCode, String message) {
            super(message);
            this.errorCode = errorCode;
        }
    }

    public static class RegistryFailureException extends RuntimeException {
        public final String errorCode;

        public RegistryFailureException(String errorCode, String message) {
            super(message);
            this.errorCode = errorCode;
        }

        public RegistryFailureException(String errorCode, String message, Throwable cause) {
            super(message, cause);
            this.errorCode = errorCode;
        }
    }
}
