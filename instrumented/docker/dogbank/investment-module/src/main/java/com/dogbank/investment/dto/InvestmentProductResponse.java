package com.dogbank.investment.dto;

import java.math.BigDecimal;
import java.util.List;

public class InvestmentProductResponse {
    public String code;
    public String name;
    public String description;
    public String riskLevel;
    public BigDecimal annualRate;
    public BigDecimal dailyRate;
    public BigDecimal referencePrice;
    public String quoteSource;
    public String updatedAt;
    public List<String> tags;
}
