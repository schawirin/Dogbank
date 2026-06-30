package com.dogbank.investment.dto;

import java.math.BigDecimal;

public class InvestmentPositionResponse {
    public String positionId;
    public Long accountId;
    public String productCode;
    public String productName;
    public String status;
    public BigDecimal principalAmount;
    public BigDecimal currentValue;
    public BigDecimal expectedValue;
    public BigDecimal driftAmount;
    public BigDecimal driftPercent;
    public BigDecimal units;
    public BigDecimal annualRate;
    public BigDecimal referencePrice;
    public String contractedBy;
    public String contractedAt;
    public String lastSyncedAt;
    public String nextSyncAt;
    public String auditCorrelationId;
    public String syncReason;
    public String message;
    public String registryId;
    public String registryProtocol;
    public String registryVenue;
    public String registryStatus;
}
