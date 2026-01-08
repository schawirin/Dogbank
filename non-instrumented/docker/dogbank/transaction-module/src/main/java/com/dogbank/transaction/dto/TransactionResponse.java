// src/main/java/com/dogbank/transaction/dto/TransactionResponse.java
package com.dogbank.transaction.dto;

import java.time.ZonedDateTime;

public class TransactionResponse {
    private Long transactionId;
    private String message;
    private ZonedDateTime startedAt;
    private ZonedDateTime completedAt;
    private String authCode;

    private String recipientInitials;
    private String receiverName;
    private String receiverBank;
    private String recipientCpfMask;

    private Double amount;

    private String senderInitials;
    private String senderName;
    private String senderBankCode;
    private String senderAgency;
    private String senderAccount;

    // Getters and Setters
    public Long getTransactionId() {
        return transactionId;
    }
    public void setTransactionId(Long transactionId) {
        this.transactionId = transactionId;
    }

    public String getMessage() {
        return message;
    }
    public void setMessage(String message) {
        this.message = message;
    }

    public ZonedDateTime getStartedAt() {
        return startedAt;
    }
    public void setStartedAt(ZonedDateTime startedAt) {
        this.startedAt = startedAt;
    }

    public ZonedDateTime getCompletedAt() {
        return completedAt;
    }
    public void setCompletedAt(ZonedDateTime completedAt) {
        this.completedAt = completedAt;
    }

    public String getAuthCode() {
        return authCode;
    }
    public void setAuthCode(String authCode) {
        this.authCode = authCode;
    }

    public String getRecipientInitials() {
        return recipientInitials;
    }
    public void setRecipientInitials(String recipientInitials) {
        this.recipientInitials = recipientInitials;
    }

    public String getReceiverName() {
        return receiverName;
    }
    public void setReceiverName(String receiverName) {
        this.receiverName = receiverName;
    }

    public String getReceiverBank() {
        return receiverBank;
    }
    public void setReceiverBank(String receiverBank) {
        this.receiverBank = receiverBank;
    }

    public String getRecipientCpfMask() {
        return recipientCpfMask;
    }
    public void setRecipientCpfMask(String recipientCpfMask) {
        this.recipientCpfMask = recipientCpfMask;
    }

    public Double getAmount() {
        return amount;
    }
    public void setAmount(Double amount) {
        this.amount = amount;
    }

    public String getSenderInitials() {
        return senderInitials;
    }
    public void setSenderInitials(String senderInitials) {
        this.senderInitials = senderInitials;
    }

    public String getSenderName() {
        return senderName;
    }
    public void setSenderName(String senderName) {
        this.senderName = senderName;
    }

    public String getSenderBankCode() {
        return senderBankCode;
    }
    public void setSenderBankCode(String senderBankCode) {
        this.senderBankCode = senderBankCode;
    }

    public String getSenderAgency() {
        return senderAgency;
    }
    public void setSenderAgency(String senderAgency) {
        this.senderAgency = senderAgency;
    }

    public String getSenderAccount() {
        return senderAccount;
    }
    public void setSenderAccount(String senderAccount) {
        this.senderAccount = senderAccount;
    }
}