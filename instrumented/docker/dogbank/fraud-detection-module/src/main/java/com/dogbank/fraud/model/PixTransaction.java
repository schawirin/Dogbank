package com.dogbank.fraud.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PixTransaction {
    private String transactionId;
    private String sourceAccountId;
    private String destinationPixKey;
    private BigDecimal amount;
    private String description;
    private LocalDateTime createdAt;
    private String status;
    private Integer retryCount;
    private String correlationId;
    private String sourceUserName;
    private String sourceUserEmail;
    private String sourceCpf;
    private String destinationUserName;
    private String destinationUserEmail;
}
