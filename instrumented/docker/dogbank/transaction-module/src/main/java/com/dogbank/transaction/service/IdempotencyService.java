package com.dogbank.transaction.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

/**
 * Prevents duplicate PIX submissions using Redis idempotency keys.
 *
 * Key: idempotency:pix:{idempotencyKey} -> "1"  TTL = 24h
 *
 * Usage: client sends X-Idempotency-Key header; if we've seen it within 24h,
 * return 409 Conflict with the original transaction ID.
 */
@Service
public class IdempotencyService {

    private static final Logger log = LoggerFactory.getLogger(IdempotencyService.class);
    private static final long TTL_HOURS = 24;

    @Autowired
    private RedisTemplate<String, String> redisTemplate;

    /**
     * Tries to claim the idempotency key.
     * Returns false if the key was already claimed (duplicate request).
     */
    public boolean tryConsume(String idempotencyKey, String transactionId) {
        String redisKey = "idempotency:pix:" + idempotencyKey;
        Boolean set = redisTemplate.opsForValue()
                .setIfAbsent(redisKey, transactionId, TTL_HOURS, TimeUnit.HOURS);
        if (Boolean.FALSE.equals(set)) {
            String existing = redisTemplate.opsForValue().get(redisKey);
            log.warn("⚠️ [Idempotency] Duplicate request key={} existing_txn={}", idempotencyKey, existing);
            return false;
        }
        log.info("✅ [Idempotency] Key claimed key={} txn={}", idempotencyKey, transactionId);
        return true;
    }

    /**
     * Returns the transaction ID previously stored for this key, or null if not found.
     */
    public String getExistingTransactionId(String idempotencyKey) {
        return redisTemplate.opsForValue().get("idempotency:pix:" + idempotencyKey);
    }
}
