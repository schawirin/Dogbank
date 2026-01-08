package com.dogbank.account.dto;

/**
 * DTO que representa informações detalhadas sobre uma conta,
 * incluindo nome do usuário, saldo e saldo investido.
 */
public class AccountInfoDTO {

    private Long accountId;
    private String userName;       // Nome do usuário associado à conta
    private Double saldo;          // Saldo em conta
    private Double saldoInvestido; // Saldo investido (se houver)

    public AccountInfoDTO() {
        // Construtor padrão (necessário para serialização e deserialização)
    }

    public AccountInfoDTO(Long accountId, String userName, Double saldo, Double saldoInvestido) {
        this.accountId = accountId;
        this.userName = userName;
        this.saldo = saldo;
        this.saldoInvestido = saldoInvestido;
    }

    public Long getAccountId() {
        return accountId;
    }
    public void setAccountId(Long accountId) {
        this.accountId = accountId;
    }

    public String getUserName() {
        return userName;
    }
    public void setUserName(String userName) {
        this.userName = userName;
    }

    public Double getSaldo() {
        return saldo;
    }
    public void setSaldo(Double saldo) {
        this.saldo = saldo;
    }

    public Double getSaldoInvestido() {
        return saldoInvestido;
    }
    public void setSaldoInvestido(Double saldoInvestido) {
        this.saldoInvestido = saldoInvestido;
    }
}
