package com.dogbank.transaction.dto;

import java.time.LocalDateTime;

public class TransactionDTO {
    private Long id;
    private Double amount;
    private String type;
    private LocalDateTime date;
    private String description;

    public TransactionDTO() {
    }

    public TransactionDTO(Long id, Double amount, String type, LocalDateTime date, String description) {
        this.id = id;
        this.amount = amount;
        this.type = type;
        this.date = date;
        this.description = description;
    }

    // Getters e Setters
    public Long getId() {
        return id;
    }
    public void setId(Long id) {
        this.id = id;
    }

    public Double getAmount() {
        return amount;
    }
    public void setAmount(Double amount) {
        this.amount = amount;
    }

    public String getType() {
        return type;
    }
    public void setType(String type) {
        this.type = type;
    }

    public LocalDateTime getDate() {
        return date;
    }
    public void setDate(LocalDateTime date) {
        this.date = date;
    }

    public String getDescription() {
        return description;
    }
    public void setDescription(String description) {
        this.description = description;
    }
}
