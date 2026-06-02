package com.dogbank.auth.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.concurrent.TimeUnit;

/**
 * Sliding window rate limiter for login attempts.
 *
 * Key: rate_limit:login:{cpf}  -> sorted set of attempt timestamps
 * Block key: rate_limit:blocked:{cpf} -> set when max attempts exceeded
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RateLimitService {

    private static final int MAX_ATTEMPTS_PER_MINUTE = 5;
    private static final int BLOCK_DURATION_MINUTES  = 15;

    private final RedisTemplate<String, String> redisTemplate;

    public boolean isBlocked(String cpf) {
        return Boolean.TRUE.equals(redisTemplate.hasKey("rate_limit:blocked:" + cpf));
    }

    /**
     * Records a failed login attempt.
     * Returns true if the account should now be blocked (threshold exceeded).
     */
    public boolean recordFailedAttempt(String cpf) {
        if (isBlocked(cpf)) return true;

        long nowMs = Instant.now().toEpochMilli();
        String key = "rate_limit:login:" + cpf;

        redisTemplate.opsForZSet().add(key, String.valueOf(nowMs), nowMs);
        long oneMinAgo = nowMs - 60_000L;
        redisTemplate.opsForZSet().removeRangeByScore(key, 0, oneMinAgo);
        redisTemplate.expire(key, 2, TimeUnit.MINUTES);

        Long count = redisTemplate.opsForZSet().zCard(key);
        int attempts = count != null ? count.intValue() : 0;

        if (attempts >= MAX_ATTEMPTS_PER_MINUTE) {
            redisTemplate.opsForValue().set(
                "rate_limit:blocked:" + cpf, "1", BLOCK_DURATION_MINUTES, TimeUnit.MINUTES);
            log.warn("🔒 [RateLimit] CPF {} blocked after {} failed attempts in 1 minute", cpf, attempts);
            return true;
        }

        log.warn("⚠️ [RateLimit] CPF {} failed login attempt {}/{}", cpf, attempts, MAX_ATTEMPTS_PER_MINUTE);
        return false;
    }

    public void clearAttempts(String cpf) {
        redisTemplate.delete("rate_limit:login:" + cpf);
        redisTemplate.delete("rate_limit:blocked:" + cpf);
    }
}
