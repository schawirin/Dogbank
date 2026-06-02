package com.dogbank.account.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Optional;

/**
 * Redis Service - Cache de leitura para CQRS Read Model
 * Estruturas mantidas:
 * - account:{id}:balance -> saldo da conta (String)
 * - account:{id}:transactions -> últimas transações (Sorted Set)
 */
@Service
public class RedisService {

    private static final Logger log = LoggerFactory.getLogger(RedisService.class);

    @Autowired
    private RedisTemplate<String, String> redisTemplate;

    @Value("${redis.cache.enabled:true}")
    private boolean cacheEnabled;

    /**
     * Busca saldo do Redis
     * Retorna Optional vazio se não encontrar (cache miss)
     */
    public Optional<BigDecimal> getBalance(Long accountId) {
        if (!cacheEnabled) {
            log.debug("Redis cache disabled, returning empty");
            return Optional.empty();
        }

        try {
            String key = String.format("account:%d:balance", accountId);
            String balanceStr = redisTemplate.opsForValue().get(key);

            if (balanceStr != null) {
                BigDecimal balance = new BigDecimal(balanceStr);
                log.info("✅ Redis CACHE HIT - account_id={}, balance={}", accountId, balance);
                return Optional.of(balance);
            } else {
                log.info("⚠️ Redis CACHE MISS - account_id={}", accountId);
                return Optional.empty();
            }
        } catch (Exception e) {
            log.error("❌ Redis error for account_id={}: {}", accountId, e.getMessage());
            // Em caso de erro no Redis, retorna empty para fazer fallback ao banco
            return Optional.empty();
        }
    }

    /**
     * Atualiza saldo no Redis (usado em casos de fallback ou inicialização)
     */
    public void setBalance(Long accountId, BigDecimal balance) {
        if (!cacheEnabled) {
            return;
        }

        try {
            String key = String.format("account:%d:balance", accountId);
            redisTemplate.opsForValue().set(key, balance.toString());
            log.info("📦 Updated Redis cache - account_id={}, balance={}", accountId, balance);
        } catch (Exception e) {
            log.error("❌ Failed to update Redis cache for account_id={}: {}", accountId, e.getMessage());
        }
    }

    /**
     * Remove saldo do Redis (invalidação de cache)
     */
    public void deleteBalance(Long accountId) {
        if (!cacheEnabled) {
            return;
        }

        try {
            String key = String.format("account:%d:balance", accountId);
            redisTemplate.delete(key);
            log.info("🗑️ Deleted Redis cache - account_id={}", accountId);
        } catch (Exception e) {
            log.error("❌ Failed to delete Redis cache for account_id={}: {}", accountId, e.getMessage());
        }
    }

    /**
     * Verifica se Redis está disponível
     */
    public boolean isAvailable() {
        if (!cacheEnabled) {
            return false;
        }

        try {
            redisTemplate.getConnectionFactory().getConnection().ping();
            return true;
        } catch (Exception e) {
            log.warn("⚠️ Redis unavailable: {}", e.getMessage());
            return false;
        }
    }
}
