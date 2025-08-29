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

    Optional<Account> findByAccountNumber(String accountNumber);

    Optional<Account> findByUserName(String userName);

    Optional<Account> findByUsuarioId(Long usuarioId);

    List<Account> findAllByUsuarioId(Long usuarioId);

    @Query(value = "SELECT a.* FROM contas a JOIN usuarios u ON a.usuario_id = u.id WHERE u.cpf = :cpf", nativeQuery = true)
    Optional<Account> findByUserCpf(@Param("cpf") String cpf);
}