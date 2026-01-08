package com.dogbank.transaction.metrics;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Classe responsável por emitir logs estruturados com métricas de negócio
 * para serem consumidos pelo Datadog para dashboards e alertas.
 * 
 * Métricas disponíveis:
 * - pix.transferencia.iniciada
 * - pix.transferencia.sucesso
 * - pix.transferencia.falha
 * - pix.validacao.banco_central
 * - pix.saldo.insuficiente
 */
@Component
public class PixBusinessMetrics {
    
    // Logger específico para métricas de negócio
    private static final Logger metricsLog = LoggerFactory.getLogger("pix.metrics");
    private static final Logger log = LoggerFactory.getLogger(PixBusinessMetrics.class);
    
    private static final DateTimeFormatter ISO_FORMATTER = DateTimeFormatter.ISO_OFFSET_DATE_TIME;
    
    /**
     * Registra o início de uma transferência PIX
     */
    public void registrarPixIniciado(Long contaOrigemId, String chavePix, BigDecimal valor) {
        try {
            MDC.put("evento", "pix.transferencia.iniciada");
            MDC.put("conta_origem_id", contaOrigemId.toString());
            MDC.put("chave_pix", chavePix);
            MDC.put("valor", formatarValor(valor));
            MDC.put("valor_numerico", valor.toString());
            MDC.put("tipo_chave", identificarTipoChave(chavePix));
            MDC.put("timestamp", ZonedDateTime.now().format(ISO_FORMATTER));
            MDC.put("faixa_valor", classificarFaixaValor(valor));
            
            metricsLog.info("PIX_INICIADO valor={} chave={} tipo={}", 
                formatarValor(valor), maskChavePix(chavePix), identificarTipoChave(chavePix));
        } finally {
            limparMDCMetricas();
        }
    }
    
    /**
     * Registra uma transferência PIX bem-sucedida
     */
    public void registrarPixSucesso(
            Long transactionId,
            Long contaOrigemId,
            Long contaDestinoId,
            String chavePix,
            BigDecimal valor,
            String nomeDestinatario,
            String bancoDestinatario,
            BigDecimal saldoAntes,
            BigDecimal saldoDepois,
            long duracaoMs
    ) {
        try {
            MDC.put("evento", "pix.transferencia.sucesso");
            MDC.put("transaction_id", transactionId.toString());
            MDC.put("conta_origem_id", contaOrigemId.toString());
            MDC.put("conta_destino_id", contaDestinoId.toString());
            MDC.put("chave_pix", chavePix);
            MDC.put("valor", formatarValor(valor));
            MDC.put("valor_numerico", valor.toString());
            MDC.put("tipo_chave", identificarTipoChave(chavePix));
            MDC.put("destinatario_nome", nomeDestinatario);
            MDC.put("destinatario_banco", bancoDestinatario);
            MDC.put("saldo_antes", formatarValor(saldoAntes));
            MDC.put("saldo_depois", formatarValor(saldoDepois));
            MDC.put("duracao_ms", String.valueOf(duracaoMs));
            MDC.put("timestamp", ZonedDateTime.now().format(ISO_FORMATTER));
            MDC.put("status_transacao", "SUCESSO");
            MDC.put("pix_sucesso", "true");
            MDC.put("pix_falha", "false");
            MDC.put("faixa_valor", classificarFaixaValor(valor));
            MDC.put("faixa_duracao", classificarFaixaDuracao(duracaoMs));
            
            metricsLog.info("PIX_SUCESSO id={} valor={} destino={} banco={} duracao={}ms", 
                transactionId, formatarValor(valor), nomeDestinatario, bancoDestinatario, duracaoMs);
        } finally {
            limparMDCMetricas();
        }
    }
    
    /**
     * Registra uma transferência PIX que falhou
     */
    public void registrarPixFalha(
            Long contaOrigemId,
            String chavePix,
            BigDecimal valor,
            String codigoErro,
            String mensagemErro,
            String tipoErro,
            long duracaoMs
    ) {
        try {
            MDC.put("evento", "pix.transferencia.falha");
            MDC.put("conta_origem_id", contaOrigemId.toString());
            MDC.put("chave_pix", chavePix);
            MDC.put("valor", formatarValor(valor));
            MDC.put("valor_numerico", valor.toString());
            MDC.put("tipo_chave", identificarTipoChave(chavePix));
            MDC.put("erro_codigo", codigoErro);
            MDC.put("erro_mensagem", mensagemErro);
            MDC.put("erro_tipo", tipoErro);
            MDC.put("duracao_ms", String.valueOf(duracaoMs));
            MDC.put("timestamp", ZonedDateTime.now().format(ISO_FORMATTER));
            MDC.put("status_transacao", "FALHA");
            MDC.put("pix_sucesso", "false");
            MDC.put("pix_falha", "true");
            MDC.put("faixa_valor", classificarFaixaValor(valor));
            
            metricsLog.error("PIX_FALHA erro={} codigo={} valor={} chave={}", 
                tipoErro, codigoErro, formatarValor(valor), maskChavePix(chavePix));
        } finally {
            limparMDCMetricas();
        }
    }
    
    /**
     * Registra validação do Banco Central
     */
    public void registrarValidacaoBancoCentral(
            String chavePix,
            BigDecimal valor,
            boolean aprovado,
            String codigoResposta,
            long tempoRespostaMs
    ) {
        try {
            MDC.put("evento", "pix.validacao.banco_central");
            MDC.put("chave_pix", chavePix);
            MDC.put("valor", formatarValor(valor));
            MDC.put("valor_numerico", valor.toString());
            MDC.put("banco_central_aprovado", String.valueOf(aprovado));
            MDC.put("banco_central_codigo", codigoResposta);
            MDC.put("tempo_banco_central_ms", String.valueOf(tempoRespostaMs));
            MDC.put("timestamp", ZonedDateTime.now().format(ISO_FORMATTER));
            
            if (aprovado) {
                metricsLog.info("BANCO_CENTRAL_APROVADO chave={} valor={} tempo={}ms", 
                    maskChavePix(chavePix), formatarValor(valor), tempoRespostaMs);
            } else {
                metricsLog.warn("BANCO_CENTRAL_REJEITADO chave={} valor={} codigo={} tempo={}ms", 
                    maskChavePix(chavePix), formatarValor(valor), codigoResposta, tempoRespostaMs);
            }
        } finally {
            limparMDCMetricas();
        }
    }
    
    /**
     * Registra tentativa de transferência com saldo insuficiente
     */
    public void registrarSaldoInsuficiente(
            Long contaOrigemId,
            BigDecimal saldoDisponivel,
            BigDecimal valorSolicitado
    ) {
        try {
            MDC.put("evento", "pix.saldo.insuficiente");
            MDC.put("conta_origem_id", contaOrigemId.toString());
            MDC.put("saldo_disponivel", formatarValor(saldoDisponivel));
            MDC.put("valor_solicitado", formatarValor(valorSolicitado));
            MDC.put("diferenca", formatarValor(valorSolicitado.subtract(saldoDisponivel)));
            MDC.put("timestamp", ZonedDateTime.now().format(ISO_FORMATTER));
            MDC.put("erro_tipo", "SALDO_INSUFICIENTE");
            
            metricsLog.warn("SALDO_INSUFICIENTE conta={} disponivel={} solicitado={}", 
                contaOrigemId, formatarValor(saldoDisponivel), formatarValor(valorSolicitado));
        } finally {
            limparMDCMetricas();
        }
    }
    
    // ==================== Métodos auxiliares ====================
    
    private String formatarValor(BigDecimal valor) {
        if (valor == null) return "R$ 0,00";
        return String.format("R$ %,.2f", valor);
    }
    
    private String identificarTipoChave(String chavePix) {
        if (chavePix == null) return "DESCONHECIDO";
        
        if (chavePix.matches("\\d{11}")) {
            return "CPF";
        } else if (chavePix.matches("\\d{14}")) {
            return "CNPJ";
        } else if (chavePix.contains("@")) {
            return "EMAIL";
        } else if (chavePix.matches("\\+?\\d{10,15}")) {
            return "TELEFONE";
        } else if (chavePix.matches("[a-f0-9\\-]{32,36}")) {
            return "CHAVE_ALEATORIA";
        }
        return "OUTRO";
    }
    
    private String maskChavePix(String chavePix) {
        if (chavePix == null || chavePix.length() < 4) return "****";
        
        String tipo = identificarTipoChave(chavePix);
        switch (tipo) {
            case "CPF":
                return chavePix.substring(0, 3) + "*****" + chavePix.substring(8);
            case "EMAIL":
                int atIndex = chavePix.indexOf("@");
                if (atIndex > 2) {
                    return chavePix.substring(0, 2) + "****" + chavePix.substring(atIndex);
                }
                return "****" + chavePix.substring(atIndex);
            case "TELEFONE":
                return chavePix.substring(0, 4) + "****" + chavePix.substring(chavePix.length() - 2);
            default:
                return chavePix.substring(0, 4) + "****";
        }
    }
    
    private String classificarFaixaValor(BigDecimal valor) {
        if (valor == null) return "INDEFINIDO";
        
        if (valor.compareTo(new BigDecimal("100")) <= 0) {
            return "ATE_100";
        } else if (valor.compareTo(new BigDecimal("500")) <= 0) {
            return "100_A_500";
        } else if (valor.compareTo(new BigDecimal("1000")) <= 0) {
            return "500_A_1000";
        } else if (valor.compareTo(new BigDecimal("5000")) <= 0) {
            return "1000_A_5000";
        } else if (valor.compareTo(new BigDecimal("10000")) <= 0) {
            return "5000_A_10000";
        } else {
            return "ACIMA_10000";
        }
    }
    
    private String classificarFaixaDuracao(long duracaoMs) {
        if (duracaoMs < 500) {
            return "RAPIDO";
        } else if (duracaoMs < 1000) {
            return "NORMAL";
        } else if (duracaoMs < 3000) {
            return "LENTO";
        } else {
            return "MUITO_LENTO";
        }
    }
    
    private void limparMDCMetricas() {
        // Remove apenas as chaves de métricas, preservando trace context do Datadog
        MDC.remove("evento");
        MDC.remove("pix_sucesso");
        MDC.remove("pix_falha");
        MDC.remove("faixa_valor");
        MDC.remove("faixa_duracao");
        MDC.remove("banco_central_aprovado");
        MDC.remove("banco_central_codigo");
        MDC.remove("tempo_banco_central_ms");
    }
}
