package com.dogbank.transaction.model;

public class UserModel {
    private Long id;
    private String nome;
    private String chavePix;
    private String cpf;
    
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
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
    
    public String getCpf() {
        return cpf;
    }
    
    public void setCpf(String cpf) {
        this.cpf = cpf;
    }
}
