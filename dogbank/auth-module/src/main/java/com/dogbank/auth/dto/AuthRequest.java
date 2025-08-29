// src/main/java/com/dogbank/auth/dto/AuthRequest.java
package com.dogbank.auth.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * DTO usado pelo endpoint POST /api/auth/login
 *
 * O campo JSON esperado pelo front-end é **"senha"**, mas internamente você
 * pode chamar de password ou senha.  Aqui optamos por manter o atributo
 * Java password e mapear com @JsonProperty("senha") para evitar qualquer
 * ambiguidade.
 */
public class AuthRequest {

    /** CPF do usuário (só números). */
    private String cpf;

    /** PIN / senha numérica de 6 dígitos. */
    @JsonProperty("senha")   // mapeia o JSON {"senha": "..."} → this.password
    private String password;

    /* ---------- getters / setters ---------- */

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
