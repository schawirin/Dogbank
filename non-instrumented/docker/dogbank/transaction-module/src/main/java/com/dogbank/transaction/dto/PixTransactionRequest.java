package com.dogbank.transaction.dto;

import java.math.BigDecimal;

public class PixTransactionRequest {
    private Long originUserId;
    private String destinationPixKey;
    private BigDecimal amount;
    private String password;
    private String description;

    // Getters e Setters
    public Long getOriginUserId() {
        return originUserId;
    }

    public void setOriginUserId(Long originUserId) {
        this.originUserId = originUserId;
    }

    public String getDestinationPixKey() {
        return destinationPixKey;
    }

    public void setDestinationPixKey(String destinationPixKey) {
        this.destinationPixKey = destinationPixKey;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }
}