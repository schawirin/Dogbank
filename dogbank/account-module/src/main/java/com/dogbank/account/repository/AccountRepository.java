package com.dogbank.account.repository;

import com.dogbank.account.entity.Account;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AccountRepository extends JpaRepository<Account, Long> {

    /**
     * Buscar conta por número da conta
     */
    Optional<Account> findByAccountNumber(String accountNumber);

    /**
     * Buscar conta por nome do usuário
     */
    Optional<Account> findByUserName(String userName);

    /**
     * Buscar conta por ID do usuário
     */
    Optional<Account> findByUsuarioId(Long usuarioId);

    /**
     * Buscar todas as contas de um usuário
     */
    List<Account> findAllByUsuarioId(Long usuarioId);

    /**
     * Buscar conta por CPF do usuário (query customizada com JOIN)
     */
    @Query(value = "SELECT a.* FROM contas a JOIN usuarios u ON a.usuario_id = u.id WHERE u.cpf = :cpf", nativeQuery = true)
    Optional<Account> findByUserCpf(@Param("cpf") String cpf);
}