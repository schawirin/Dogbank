package com.dogbank.transaction.controller;

import com.dogbank.transaction.dto.TransactionRequest;
import com.dogbank.transaction.exception.UserBlockedException;
import com.dogbank.transaction.service.IdempotencyService;
import com.dogbank.transaction.service.TransactionService;
import com.dogbank.transaction.testutil.Log4jCapture;
import org.apache.logging.log4j.core.LogEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TransactionControllerTest {

    private static final String CHAVE = "pedro.silva@dogbank.com";
    private static final String EFFECTIVE_KEY = "auto-4-" + CHAVE;

    @Mock private TransactionService transactionService;
    @Mock private IdempotencyService idempotencyService;
    private TransactionController controller;

    @BeforeEach
    void setUp() {
        controller = new TransactionController(transactionService, idempotencyService);
    }

    private TransactionRequest pixRequest() {
        TransactionRequest r = new TransactionRequest();
        r.setAccountOriginId(4L);
        r.setPixKeyDestination(CHAVE);
        r.setAmount(new BigDecimal("100.00"));
        r.setPassword("123456");
        return r;
    }

    /**
     * Bug 1: qualquer falha após reivindicar a chave (timeout do BC/SPI, saldo, etc.) deve
     * LIBERAR a chave de idempotência, para não travar um retry legítimo por 24h.
     */
    @Test
    void pixQueFalha_liberaChaveDeIdempotencia() {
        when(idempotencyService.tryConsume(anyString(), anyString())).thenReturn(true);
        when(transactionService.validarSenha(4L, "123456")).thenReturn(true);
        when(transactionService.transferirPix(eq(4L), eq(CHAVE), any(BigDecimal.class)))
                .thenThrow(new RuntimeException("SPI-TIMEOUT"));

        assertThatThrownBy(() -> controller.transferirViaPix(pixRequest(), null))
                .isInstanceOf(RuntimeException.class);

        verify(idempotencyService).release(EFFECTIVE_KEY);
    }

    @Test
    void usuarioBloqueado_retorna403ComMotivoExplicitoELiberaIdempotencia() {
        when(idempotencyService.tryConsume(anyString(), anyString())).thenReturn(true);
        when(transactionService.validarSenha(4L, "123456")).thenThrow(new UserBlockedException());

        ResponseEntity<?> response = controller.transferirViaPix(pixRequest(), null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertThat(body.get("reason")).isEqualTo("USER_BLOCKED");
        verify(idempotencyService).release(EFFECTIVE_KEY);
        verify(transactionService, never()).transferirPix(any(), any(), any());
    }

    /**
     * Bug 2: uma requisição duplicada (409) deve emitir o evento estruturado de falha
     * (@evento:pix.transferencia.falha, erro_tipo=IDEMPOTENCIA) para os dashboards/SIEM,
     * e NÃO deve reprocessar a transferência (sem double-spend).
     */
    @Test
    void requisicaoDuplicada_emiteEventoEstruturadoDeFalha() {
        when(idempotencyService.tryConsume(anyString(), anyString())).thenReturn(false);
        when(idempotencyService.getExistingTransactionId(EFFECTIVE_KEY)).thenReturn("txn-original-123");

        ResponseEntity<?> resp;
        LogEvent falha;
        try (Log4jCapture cap =
                     new Log4jCapture("com.dogbank.transaction.controller.TransactionController")) {
            resp = controller.transferirViaPix(pixRequest(), null);
            falha = cap.firstWithEvento("pix.transferencia.falha").orElse(null);
        }

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        verify(transactionService, never()).transferirPix(any(), any(), any());

        assertThat(falha)
                .as("a duplicata deve emitir @evento:pix.transferencia.falha")
                .isNotNull();
        Map<String, String> mdc = Log4jCapture.mdc(falha);
        assertThat(mdc)
                .containsEntry("evento", "pix.transferencia.falha")
                .containsEntry("erro_tipo", "IDEMPOTENCIA")
                .containsEntry("erro_codigo", "DUPLICATE_REQUEST")
                .containsEntry("status_transacao", "FALHA")
                .containsEntry("pix_falha", "true");
    }
}
