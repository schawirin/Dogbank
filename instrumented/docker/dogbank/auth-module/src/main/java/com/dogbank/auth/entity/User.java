package com.dogbank.auth.entity;

import javax.persistence.*;

@Entity
@Table(name = "usuarios") // nome da tabela no banco de dados
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "cpf", nullable = false, unique = true)
    private String cpf;

    @Column(name = "senha", nullable = false)
    private String senha;

    @Column(name = "nome", nullable = false)
    private String nome;

    @Column(name = "email", unique = true)
    private String email;

    @Column(name = "chave_pix", unique = true, nullable = false)
    private String chavePix;

    // Construtor padrão (obrigatório para JPA)
    public User() {
    }

    // Construtor com todos os campos
    public User(Long id, String cpf, String senha, String nome, String email, String chavePix) {
        this.id = id;
        this.cpf = cpf;
        this.senha = senha;
        this.nome = nome;
        this.email = email;
        this.chavePix = chavePix;
    }

    // Getters e Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getCpf() {
        return cpf;
    }

    public void setCpf(String cpf) {
        this.cpf = cpf;
    }

    public String getSenha() {
        return senha;
    }

    public void setSenha(String senha) {
        this.senha = senha;
    }

    public String getNome() {
        return nome;
    }

    public void setNome(String nome) {
        this.nome = nome;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getChavePix() {
        return chavePix;
    }

    public void setChavePix(String chavePix) {
        this.chavePix = chavePix;
    }
}
