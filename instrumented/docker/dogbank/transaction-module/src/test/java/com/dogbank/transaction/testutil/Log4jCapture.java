package com.dogbank.transaction.testutil;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.core.LogEvent;
import org.apache.logging.log4j.core.Logger;
import org.apache.logging.log4j.core.appender.AbstractAppender;
import org.apache.logging.log4j.core.config.Property;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Captura, em memória, os {@link LogEvent}s (com o snapshot do MDC/ThreadContext) emitidos por um
 * logger específico do Log4j2 durante um teste. Usado para assegurar que os eventos estruturados de
 * falha (evento=pix.transferencia.falha, erro_tipo, erro_codigo, ...) são realmente emitidos —
 * exatamente os atributos que os dashboards e as regras de SIEM consomem.
 *
 * Uso:
 * <pre>
 *   try (Log4jCapture cap = new Log4jCapture("pix.metrics")) {
 *       ... ação que loga ...
 *       LogEvent falha = cap.firstWithEvento("pix.transferencia.falha").orElseThrow();
 *       assertThat(Log4jCapture.mdc(falha)).containsEntry("erro_tipo", "TIMEOUT");
 *   }
 * </pre>
 */
public final class Log4jCapture implements AutoCloseable {

    private static final AtomicInteger SEQ = new AtomicInteger();

    private final Logger logger;
    private final CaptureAppender appender;

    public Log4jCapture(String loggerName) {
        this.appender = new CaptureAppender("capture-" + loggerName + "-" + SEQ.incrementAndGet());
        this.appender.start();
        this.logger = (Logger) LogManager.getLogger(loggerName);
        this.logger.addAppender(appender);
    }

    /** Todos os eventos capturados (imutáveis, com contextData/MDC preservado no momento do log). */
    public List<LogEvent> events() {
        return appender.events;
    }

    /** Primeiro evento cujo MDC {@code evento} é igual ao valor informado. */
    public Optional<LogEvent> firstWithEvento(String evento) {
        return appender.events.stream()
                .filter(e -> evento.equals(e.getContextData().getValue("evento")))
                .findFirst();
    }

    /** Atalho para o mapa MDC (contextData) de um evento. */
    public static Map<String, String> mdc(LogEvent e) {
        return e.getContextData().toMap();
    }

    @Override
    public void close() {
        logger.removeAppender(appender);
        appender.stop();
    }

    private static final class CaptureAppender extends AbstractAppender {
        final List<LogEvent> events = new CopyOnWriteArrayList<>();

        CaptureAppender(String name) {
            super(name, null, null, true, Property.EMPTY_ARRAY);
        }

        @Override
        public void append(LogEvent event) {
            // toImmutable() congela o snapshot do MDC junto com o evento.
            events.add(event.toImmutable());
        }
    }
}
