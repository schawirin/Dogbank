package com.dogbank.account.entity;

import javax.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "contas")
public class Account {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "usuario_id", nullable = false)
    private Long usuarioId;

    @Column(name = "numero_conta")
    private String accountNumber;

    @Column(name = "saldo")
    private BigDecimal balance;

    @Column(name = "user_name")
    private String userName;

    @Column(name = "banco")  // Adicionando a coluna banco
    private String banco;    // Adicionando a variável banco

    @Column(name = "saldo_investido")
    private BigDecimal saldoInvestido;

    public Account() {}

    public Long getId() {
        return id;
    }
    public void setId(Long id) {
        this.id = id;
    }

    public String getBanco() {
        return banco;
    }
    public void setBanco(String banco) {  // Também adicionando o setter
        this.banco = banco;
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