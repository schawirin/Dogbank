package com.dogbank.investment.repository;

import com.dogbank.investment.entity.InvestmentPosition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InvestmentPositionRepository extends JpaRepository<InvestmentPosition, Long> {
    List<InvestmentPosition> findByAccountIdOrderByContractedAtDesc(Long accountId);
    Optional<InvestmentPosition> findByPositionId(String positionId);
    boolean existsByPositionId(String positionId);
    long countByAccountId(Long accountId);
}
