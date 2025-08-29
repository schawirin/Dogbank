// src/main/java/com/dogbank/auth/repository/UserRepository.java
package com.dogbank.auth.repository;

import com.dogbank.auth.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repositório de usuários.
 *
 * ▸ Os dois métodos retornam Optional<User>, pois cada CPF / chave PIX
 *   deve ser único na base.  
 * ▸ Uso de TRIM() garante que espaços indesejados gravados na coluna
 *   não prejudiquem a busca.
 */
@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    /** Busca único usuário pelo CPF (sem espaços). */
    @Query("SELECT DISTINCT u FROM User u WHERE TRIM(u.cpf) = :cpf")
    Optional<User> findByCpf(@Param("cpf") String cpf);

    /** Busca único usuário pela chave PIX (e-mail, telefone, aleatória). */
    @Query("SELECT DISTINCT u FROM User u WHERE TRIM(u.chavePix) = :chavePix")
    Optional<User> findByChavePix(@Param("chavePix") String chavePix);
}
