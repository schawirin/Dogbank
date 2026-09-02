package com.dogbank.transaction.metrics;

import com.dogbank.transaction.testutil.Log4jCapture;
import org.apache.logging.log4j.core.LogEvent;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class PixBusinessMetricsTest {

    /**
     * Bug 3: o timeout do Banco Central / SPI deve emitir o evento estruturado de falha
     * com erro_tipo=TIMEOUT e erro_codigo=BANCO_CENTRAL_TIMEOUT — os atributos que os
     * dashboards ("PIX Com Falha") e as regras de SIEM agrupam.
     */
    @Test
    void timeoutBancoCentral_emiteEventoEstruturadoDeFalha() {
        PixBusinessMetrics metrics = new PixBusinessMetrics();

        LogEvent falha;
        try (Log4jCapture cap = new Log4jCapture("pix.metrics")) {
            metrics.registrarPixFalha(
                    4L,
                    "pedro.silva@dogbank.com",
                    new BigDecimal("100.00"),
                    "BANCO_CENTRAL_TIMEOUT",
                    "Timeout na validação com o Banco Central / SPI",
                    "TIMEOUT",
                    4000L);
            falha = cap.firstWithEvento("pix.transferencia.falha").orElse(null);
        }

        assertThat(falha)
                .as("registrarPixFalha deve emitir @evento:pix.transferencia.falha")
                .isNotNull();
        Map<String, String> mdc = Log4jCapture.mdc(falha);
        assertThat(mdc)
                .containsEntry("evento", "pix.transferencia.falha")
                .containsEntry("erro_tipo", "TIMEOUT")
                .containsEntry("erro_codigo", "BANCO_CENTRAL_TIMEOUT")
                .containsEntry("status_transacao", "FALHA")
                .containsEntry("pix_falha", "true")
                .containsEntry("pix_sucesso", "false");
    }
}
