package com.dogbank.transaction.entity;

import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZonedDateTime;

@Entity
@Table(name = "transactions")
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long accountOriginId;
    private Long accountDestinationId;
    private BigDecimal amount;
    private String type;  // Ex.: "PIX"
    private LocalDateTime date;
    private String description;

    private ZonedDateTime startedAt;
    private ZonedDateTime completedAt;
    private String pixKeyDestination;
    private String receiverName;
    private String receiverBank;
    private String senderName;
    private String senderBankCode;
    private String senderAgency;
    private String senderAccountNumber;

    public Transaction() {
    }

    // Getters e Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getAccountOriginId() { return accountOriginId; }
    public void setAccountOriginId(Long accountOriginId) { this.accountOriginId = accountOriginId; }

    public Long getAccountDestinationId() { return accountDestinationId; }
    public void setAccountDestinationId(Long accountDestinationId) { this.accountDestinationId = accountDestinationId; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public LocalDateTime getDate() { return date; }
    public void setDate(LocalDateTime date) { this.date = date; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public ZonedDateTime getStartedAt() { return startedAt; }
    public void setStartedAt(ZonedDateTime startedAt) { this.startedAt = startedAt; }

    public ZonedDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(ZonedDateTime completedAt) { this.completedAt = completedAt; }

    public String getPixKeyDestination() { return pixKeyDestination; }
    public void setPixKeyDestination(String pixKeyDestination) { this.pixKeyDestination = pixKeyDestination; }

    public String getReceiverName() { return receiverName; }
    public void setReceiverName(String receiverName) { this.receiverName = receiverName; }

    public String getReceiverBank() { return receiverBank; }
    public void setReceiverBank(String receiverBank) { this.receiverBank = receiverBank; }

    public String getSenderName() { return senderName; }
    public void setSenderName(String senderName) { this.senderName = senderName; }

    public String getSenderBankCode() { return senderBankCode; }
    public void setSenderBankCode(String senderBankCode) { this.senderBankCode = senderBankCode; }

    public String getSenderAgency() { return senderAgency; }
    public void setSenderAgency(String senderAgency) { this.senderAgency = senderAgency; }

    public String getSenderAccountNumber() { return senderAccountNumber; }
    public void setSenderAccountNumber(String senderAccountNumber) { this.senderAccountNumber = senderAccountNumber; }
}
