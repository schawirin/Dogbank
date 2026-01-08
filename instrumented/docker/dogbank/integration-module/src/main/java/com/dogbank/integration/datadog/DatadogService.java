package com.dogbank.integration.datadog;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.Map;

/**
 * Serviço seguro para comunicação com Datadog.
 * 
 * A API key é mantida no backend e não é exposta para o frontend.
 * O frontend faz requisições para os endpoints REST deste serviço.
 */
@Service
public class DatadogService {

    private static final Logger logger = LoggerFactory.getLogger(DatadogService.class);

    @Value("${datadog.api-key:}")
    private String datadogApiKey;

    @Value("${datadog.app-key:}")
    private String datadogAppKey;

    @Value("${datadog.api-url:https://api.datadoghq.com}")
    private String datadogApiUrl;

    @Value("${datadog.enabled:false}")
    private boolean datadogEnabled;

    private final RestTemplate restTemplate;

    public DatadogService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    /**
     * Busca métricas do Datadog de forma segura
     * 
     * @param query Query para buscar métricas (ex: "avg:system.cpu{*}")
     * @param from Timestamp inicial (em segundos)
     * @param to Timestamp final (em segundos)
     * @return Dados da métrica
     */
    public Map<String, Object> getMetrics(String query, long from, long to) {
        if (!datadogEnabled) {
            logger.warn("Datadog está desabilitado");
            return new HashMap<>();
        }

        try {
            String url = String.format("%s/api/v1/query?query=%s&from=%d&to=%d",
                    datadogApiUrl, 
                    query, 
                    from, 
                    to);

            HttpHeaders headers = createHeaders();
            HttpEntity<String> entity = new HttpEntity<>(headers);

            ResponseEntity<Map> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    entity,
                    Map.class
            );

            logger.info("Métricas obtidas com sucesso do Datadog");
            return response.getBody() != null ? response.getBody() : new HashMap<>();

        } catch (Exception e) {
            logger.error("Erro ao buscar métricas do Datadog", e);
            return new HashMap<>();
        }
    }

    /**
     * Busca logs do Datadog de forma segura
     * 
     * @param query Query para buscar logs
     * @param from Timestamp inicial (em milissegundos)
     * @param to Timestamp final (em milissegundos)
     * @return Dados dos logs
     */
    public Map<String, Object> getLogs(String query, long from, long to) {
        if (!datadogEnabled) {
            logger.warn("Datadog está desabilitado");
            return new HashMap<>();
        }

        try {
            String url = String.format("%s/api/v2/logs/events?filter[query]=%s&filter[from]=%d&filter[to]=%d",
                    datadogApiUrl,
                    query,
                    from,
                    to);

            HttpHeaders headers = createHeaders();
            headers.set("Accept", "application/json");

            HttpEntity<String> entity = new HttpEntity<>(headers);

            ResponseEntity<Map> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    entity,
                    Map.class
            );

            logger.info("Logs obtidos com sucesso do Datadog");
            return response.getBody() != null ? response.getBody() : new HashMap<>();

        } catch (Exception e) {
            logger.error("Erro ao buscar logs do Datadog", e);
            return new HashMap<>();
        }
    }

    /**
     * Busca dados de um dashboard específico
     * 
     * @param dashboardId ID do dashboard no Datadog
     * @return Dados do dashboard
     */
    public Map<String, Object> getDashboardData(String dashboardId) {
        if (!datadogEnabled) {
            logger.warn("Datadog está desabilitado");
            return new HashMap<>();
        }

        try {
            String url = String.format("%s/api/v1/dashboard/%s", datadogApiUrl, dashboardId);

            HttpHeaders headers = createHeaders();
            HttpEntity<String> entity = new HttpEntity<>(headers);

            ResponseEntity<Map> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    entity,
                    Map.class
            );

            logger.info("Dashboard obtido com sucesso do Datadog");
            return response.getBody() != null ? response.getBody() : new HashMap<>();

        } catch (Exception e) {
            logger.error("Erro ao buscar dashboard do Datadog", e);
            return new HashMap<>();
        }
    }

    /**
     * Busca status de serviços (Service Level Objectives - SLOs)
     * 
     * @return Dados dos SLOs
     */
    public Map<String, Object> getSLOs() {
        if (!datadogEnabled) {
            logger.warn("Datadog está desabilitado");
            return new HashMap<>();
        }

        try {
            String url = String.format("%s/api/v1/slo", datadogApiUrl);

            HttpHeaders headers = createHeaders();
            HttpEntity<String> entity = new HttpEntity<>(headers);

            ResponseEntity<Map> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    entity,
                    Map.class
            );

            logger.info("SLOs obtidos com sucesso do Datadog");
            return response.getBody() != null ? response.getBody() : new HashMap<>();

        } catch (Exception e) {
            logger.error("Erro ao buscar SLOs do Datadog", e);
            return new HashMap<>();
        }
    }

    /**
     * Cria headers de autenticação seguros
     */
    private HttpHeaders createHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("DD-API-KEY", datadogApiKey);
        headers.set("DD-APPLICATION-KEY", datadogAppKey);
        headers.set("Content-Type", "application/json");
        return headers;
    }

    /**
     * Valida se as credenciais do Datadog estão configuradas
     */
    public boolean isConfigured() {
        return datadogEnabled && 
               datadogApiKey != null && !datadogApiKey.isEmpty() &&
               datadogAppKey != null && !datadogAppKey.isEmpty();
    }
}
