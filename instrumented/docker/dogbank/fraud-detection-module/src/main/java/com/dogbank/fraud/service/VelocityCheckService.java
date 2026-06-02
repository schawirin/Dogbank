package com.dogbank.fraud.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.concurrent.TimeUnit;

/**
 * Redis-based sliding window velocity checks.
 *
 * Key patterns:
 *   fraud:velocity:{pixKey}:1m  -> sorted set of txn timestamps in last 60s
 *   fraud:velocity:{pixKey}:1h  -> sorted set of txn timestamps in last 3600s
 *   fraud:seen:{txnId}          -> dedup (already analysed this txId?)
 *   fraud:blocked:{userId}      -> user blocked by fraud decision
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class VelocityCheckService {

    private static final int LIMIT_PER_MINUTE = 5;
    private static final int LIMIT_PER_HOUR   = 30;

    private final RedisTemplate<String, String> redisTemplate;

    public boolean isAlreadySeen(String transactionId) {
        String key = "fraud:seen:" + transactionId;
        Boolean absent = redisTemplate.opsForValue().setIfAbsent(key, "1", 2, TimeUnit.HOURS);
        return Boolean.FALSE.equals(absent);
    }

    public boolean isUserBlocked(String accountId) {
        return Boolean.TRUE.equals(redisTemplate.hasKey("fraud:blocked:" + accountId));
    }

    public void blockUser(String accountId, int ttlHours) {
        redisTemplate.opsForValue().set("fraud:blocked:" + accountId, "1", ttlHours, TimeUnit.HOURS);
        log.warn("🔒 Fraud block applied to accountId={} for {}h", accountId, ttlHours);
    }

    /**
     * Records the current transaction in the sliding windows and returns
     * the number of transactions in the last 1 minute and 1 hour.
     */
    public VelocityResult recordAndCheck(String pixKey, String transactionId) {
        long nowMs = Instant.now().toEpochMilli();
        String keyMin = "fraud:velocity:" + pixKey + ":1m";
        String keyHour = "fraud:velocity:" + pixKey + ":1h";

        // Add current txn timestamp
        redisTemplate.opsForZSet().add(keyMin, transactionId + ":" + nowMs, nowMs);
        redisTemplate.opsForZSet().add(keyHour, transactionId + ":" + nowMs, nowMs);

        // Remove entries outside the window
        long oneMinAgo = nowMs - 60_000L;
        long oneHourAgo = nowMs - 3_600_000L;
        redisTemplate.opsForZSet().removeRangeByScore(keyMin, 0, oneMinAgo);
        redisTemplate.opsForZSet().removeRangeByScore(keyHour, 0, oneHourAgo);

        // Set TTL so keys self-expire
        redisTemplate.expire(keyMin, 2, TimeUnit.MINUTES);
        redisTemplate.expire(keyHour, 2, TimeUnit.HOURS);

        Long countMin = redisTemplate.opsForZSet().zCard(keyMin);
        Long countHour = redisTemplate.opsForZSet().zCard(keyHour);

        int cntMin = countMin != null ? countMin.intValue() : 0;
        int cntHour = countHour != null ? countHour.intValue() : 0;

        return new VelocityResult(cntMin, cntHour,
                cntMin > LIMIT_PER_MINUTE, cntHour > LIMIT_PER_HOUR);
    }

    public record VelocityResult(int countPerMinute, int countPerHour,
                                 boolean exceededPerMinute, boolean exceededPerHour) {
        public boolean exceeded() { return exceededPerMinute || exceededPerHour; }
    }
}
