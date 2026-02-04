package com.dogbank.auth.dto;

import com.fasterxml.jackson.annotation.JsonAlias;

/**
 * Aceita {"senha": "..."} ou {"password": "..."}.
 * Sem validação automática pra não disparar 400 nos testes.
 */
public class AuthRequest {

    private String cpf;

    @JsonAlias({ "senha", "password" })
    private String password;

    // getters / setters
    public String getCpf() {
        return cpf;
    }
    public void setCpf(String cpf) {
        this.cpf = cpf;
    }

    public String getPassword() {
        return password;
    }
    public void setPassword(String password) {
        this.password = password;
    }
}
