package com.dogbank.transaction.dto;

import java.math.BigDecimal;

public class TransactionRequest {
    private Long accountOriginId;
    private Long accountDestinationId; // Opcional, se o ID da conta destino for informado diretamente
    private BigDecimal amount;
    private String pixKeyDestination;  // Para transferências via PIX

    // Getters e Setters
    public Long getAccountOriginId() {
        return accountOriginId;
    }
    public void setAccountOriginId(Long accountOriginId) {
        this.accountOriginId = accountOriginId;
    }

    public Long getAccountDestinationId() {
        return accountDestinationId;
    }
    public void setAccountDestinationId(Long accountDestinationId) {
        this.accountDestinationId = accountDestinationId;
    }

    public BigDecimal getAmount() {
        return amount;
    }
    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public String getPixKeyDestination() {
        return pixKeyDestination;
    }
    public void setPixKeyDestination(String pixKeyDestination) {
        this.pixKeyDestination = pixKeyDestination;
    }
}
