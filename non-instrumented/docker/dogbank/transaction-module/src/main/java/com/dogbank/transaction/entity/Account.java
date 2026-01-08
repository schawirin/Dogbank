package com.dogbank.account.entity;

import javax.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "contas")
public class Account {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "usuario_id")
    private Long usuarioId; // Identificador do usuário associado à conta

    @Column(name = "numero_conta")
    private String accountNumber;

    @Column(name = "saldo")
    private BigDecimal balance;

    @Column(name = "user_name")
    private String userName;

    @Column(name = "saldo_investido")
    private BigDecimal saldoInvestido;

    // Getters e Setters
    public Long getId() {
        return id;
    }
    public void setId(Long id) {
        this.id = id;
    }

    public Long getUsuarioId() {
        return usuarioId;
    }
    public void setUsuarioId(Long usuarioId) {
        this.usuarioId = usuarioId;
    }

    public String getAccountNumber() {
        return accountNumber;
    }
    public void setAccountNumber(String accountNumber) {
        this.accountNumber = accountNumber;
    }

    public BigDecimal getBalance() {
        return balance;
    }
    public void setBalance(BigDecimal balance) {
        this.balance = balance;
    }

    public String getUserName() {
        return userName;
    }
    public void setUserName(String userName) {
        this.userName = userName;
    }

    public BigDecimal getSaldoInvestido() {
        return saldoInvestido;
    }
    public void setSaldoInvestido(BigDecimal saldoInvestido) {
        this.saldoInvestido = saldoInvestido;
    }
}
