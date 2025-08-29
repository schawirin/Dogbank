package com.dogbank.transaction.repository;

import com.dogbank.transaction.entity.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

/**
 * Repositório para operações de transação.
 */
@Repository
public interface TransactionRepository extends JpaRepository<Transaction, Long> {

    /**
     * Lista todas as transações em que a conta informada seja origem OU destino, ordenadas por data desc.
     */
    @Query("SELECT t FROM Transaction t " +
           "WHERE t.accountOriginId = :accountId " +
           "   OR t.accountDestinationId = :accountId " +
           "ORDER BY t.date DESC")
    List<Transaction> findAllByAccountId(@Param("accountId") Long accountId);

    /**
     * Lista transações em que a conta informada é a conta de origem.
     */
    List<Transaction> findAllByAccountOriginIdOrderByDateDesc(Long accountOriginId);

    /**
     * Lista transações em que a conta informada é a conta de destino.
     */
    List<Transaction> findAllByAccountDestinationIdOrderByDateDesc(Long accountDestinationId);
}