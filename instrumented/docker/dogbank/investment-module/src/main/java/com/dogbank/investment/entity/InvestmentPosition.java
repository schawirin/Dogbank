package com.dogbank.investment.entity;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Index;
import javax.persistence.Table;
import javax.persistence.UniqueConstraint;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(
    name = "investment_positions",
    uniqueConstraints = {
        @UniqueConstraint(name = "uk_investment_position_id", columnNames = "position_id")
    },
    indexes = {
        @Index(name = "idx_investment_positions_account", columnList = "account_id"),
        @Index(name = "idx_investment_positions_cpf", columnList = "cpf"),
        @Index(name = "idx_investment_positions_status", columnList = "status")
    }
)
public class InvestmentPosition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "position_id", nullable = false, length = 40)
    private String positionId;

    @Column(name = "account_id", nullable = false)
    private Long accountId;

    @Column(length = 20)
    private String cpf;

    @Column(name = "user_name", length = 120)
    private String userName;

    @Column(name = "product_code", nullable = false, length = 32)
    private String productCode;

    @Column(name = "principal_amount", nullable = false, precision = 19, scale = 2)
    private BigDecimal principalAmount;

    @Column(name = "current_value", nullable = false, precision = 19, scale = 2)
    private BigDecimal currentValue;

    @Column(precision = 19, scale = 8)
    private BigDecimal units;

    @Column(nullable = false, length = 24)
    private String status;

    @Column(name = "contracted_by", length = 80)
    private String contractedBy;

    @Column(name = "contracted_at", nullable = false)
    private Instant contractedAt;

    @Column(name = "last_synced_at", nullable = false)
    private Instant lastSyncedAt;

    @Column(name = "audit_correlation_id", nullable = false, length = 80)
    private String auditCorrelationId;

    @Column(name = "sync_reason", length = 80)
    private String syncReason;

    @Column(name = "sync_attempts", nullable = false)
    private int syncAttempts;

    @Column(name = "registry_id", length = 80)
    private String registryId;

    @Column(name = "registry_protocol", length = 120)
    private String registryProtocol;

    @Column(name = "registry_venue", length = 80)
    private String registryVenue;

    @Column(name = "registry_status", length = 40)
    private String registryStatus;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getPositionId() {
        return positionId;
    }

    public void setPositionId(String positionId) {
        this.positionId = positionId;
    }

    public Long getAccountId() {
        return accountId;
    }

    public void setAccountId(Long accountId) {
        this.accountId = accountId;
    }

    public String getCpf() {
        return cpf;
    }

    public void setCpf(String cpf) {
        this.cpf = cpf;
    }

    public String getUserName() {
        return userName;
    }

    public void setUserName(String userName) {
        this.userName = userName;
    }

    public String getProductCode() {
        return productCode;
    }

    public void setProductCode(String productCode) {
        this.productCode = productCode;
    }

    public BigDecimal getPrincipalAmount() {
        return principalAmount;
    }

    public void setPrincipalAmount(BigDecimal principalAmount) {
        this.principalAmount = principalAmount;
    }

    public BigDecimal getCurrentValue() {
        return currentValue;
    }

    public void setCurrentValue(BigDecimal currentValue) {
        this.currentValue = currentValue;
    }

    public BigDecimal getUnits() {
        return units;
    }

    public void setUnits(BigDecimal units) {
        this.units = units;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getContractedBy() {
        return contractedBy;
    }

    public void setContractedBy(String contractedBy) {
        this.contractedBy = contractedBy;
    }

    public Instant getContractedAt() {
        return contractedAt;
    }

    public void setContractedAt(Instant contractedAt) {
        this.contractedAt = contractedAt;
    }

    public Instant getLastSyncedAt() {
        return lastSyncedAt;
    }

    public void setLastSyncedAt(Instant lastSyncedAt) {
        this.lastSyncedAt = lastSyncedAt;
    }

    public String getAuditCorrelationId() {
        return auditCorrelationId;
    }

    public void setAuditCorrelationId(String auditCorrelationId) {
        this.auditCorrelationId = auditCorrelationId;
    }

    public String getSyncReason() {
        return syncReason;
    }

    public void setSyncReason(String syncReason) {
        this.syncReason = syncReason;
    }

    public int getSyncAttempts() {
        return syncAttempts;
    }

    public void setSyncAttempts(int syncAttempts) {
        this.syncAttempts = syncAttempts;
    }

    public String getRegistryId() {
        return registryId;
    }

    public void setRegistryId(String registryId) {
        this.registryId = registryId;
    }

    public String getRegistryProtocol() {
        return registryProtocol;
    }

    public void setRegistryProtocol(String registryProtocol) {
        this.registryProtocol = registryProtocol;
    }

    public String getRegistryVenue() {
        return registryVenue;
    }

    public void setRegistryVenue(String registryVenue) {
        this.registryVenue = registryVenue;
    }

    public String getRegistryStatus() {
        return registryStatus;
    }

    public void setRegistryStatus(String registryStatus) {
        this.registryStatus = registryStatus;
    }
}
