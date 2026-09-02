package com.dogbank.transaction.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bug 1 (nível de serviço): a chave de idempotência precisa poder ser LIBERADA quando a
 * transação falha, para não bloquear um retry legítimo por 24h.
 */
@ExtendWith(MockitoExtension.class)
class IdempotencyServiceTest {

    @Mock private RedisTemplate<String, String> redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;
    @InjectMocks private IdempotencyService service;

    @Test
    void release_deletaChaveDoRedis() {
        service.release("auto-4-pedro.silva@dogbank.com");

        verify(redisTemplate).delete("idempotency:pix:auto-4-pedro.silva@dogbank.com");
    }

    @Test
    void tryConsume_retornaFalse_quandoChaveJaReivindicada() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.setIfAbsent(eq("idempotency:pix:k1"), eq("tx-1"), anyLong(), any(TimeUnit.class)))
                .thenReturn(false);
        when(valueOps.get("idempotency:pix:k1")).thenReturn("tx-existente");

        assertThat(service.tryConsume("k1", "tx-1")).isFalse();
    }

    @Test
    void tryConsume_retornaTrue_quandoChaveLivre() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.setIfAbsent(eq("idempotency:pix:k2"), eq("tx-2"), anyLong(), any(TimeUnit.class)))
                .thenReturn(true);

        assertThat(service.tryConsume("k2", "tx-2")).isTrue();
    }
}
