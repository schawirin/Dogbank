package com.dogbank.auth.dto;

public class LoginResponse {
    private String message;
    private String nome;
    private String chavePix;
    private Long accountId;

    public LoginResponse() {
    }

    public LoginResponse(String message, String nome, String chavePix, Long accountId) {
        this.message = message;
        this.nome = nome;
        this.chavePix = chavePix;
        this.accountId = accountId;
    }

    public String getMessage() {
        return message;
    }
    public void setMessage(String message) {
        this.message = message;
    }

    public String getNome() {
        return nome;
    }
    public void setNome(String nome) {
        this.nome = nome;
    }

    public String getChavePix() {
        return chavePix;
    }
    public void setChavePix(String chavePix) {
        this.chavePix = chavePix;
    }

    public Long getAccountId() {
        return accountId;
    }
    public void setAccountId(Long accountId) {
        this.accountId = accountId;
    }
}
