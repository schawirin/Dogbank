package com.dogbank.auth.repository;

import com.dogbank.auth.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    
    /**
     * Buscar usuário por email
     */
    Optional<User> findByEmail(String email);
    
    /**
     * Buscar usuário por CPF
     */
    Optional<User> findByCpf(String cpf);
    
    /**
     * Buscar usuário por chave PIX
     */
    Optional<User> findByChavePix(String chavePix);

    /**
     * Contas SEM MFA — o "segmento vulnerável" que o ATO por senha compromete.
     * Usado pela auto-remediação (bloquear/desbloquear em massa via Datadog Workflow).
     */
    List<User> findByMfaFalse();
}