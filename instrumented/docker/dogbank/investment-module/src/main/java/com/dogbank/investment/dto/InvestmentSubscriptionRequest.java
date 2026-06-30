package com.dogbank.investment.dto;

import java.math.BigDecimal;

public class InvestmentSubscriptionRequest {
    public Long accountId;
    public String cpf;
    public String userName;
    public String productCode;
    public BigDecimal amount;
    public String requestedBy;
}
