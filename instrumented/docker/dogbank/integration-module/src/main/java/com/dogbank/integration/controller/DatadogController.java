package com.dogbank.integration.controller;

import com.dogbank.integration.datadog.DatadogService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.Map;

/**
 * Controlador REST para expor métricas do Datadog de forma segura.
 * 
 * CORS: Os headers CORS são configurados no Spring Security
 * APIKey: Mantida no backend e não exposta ao frontend
 */
@RestController
@RequestMapping("/api/observability/datadog")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:3001"}, 
             allowedHeaders = "*", 
             methods = {RequestMethod.GET, RequestMethod.OPTIONS})
public class DatadogController {

    private static final Logger logger = LoggerFactory.getLogger(DatadogController.class);

    @Autowired
    private DatadogService datadogService;

    /**
     * Endpoint para obter métricas
     * 
     * GET /api/observability/datadog/metrics?query=avg:system.cpu&from=1234567890&to=1234567900
     */
    @GetMapping("/metrics")
    public ResponseEntity<Map<String, Object>> getMetrics(
            @RequestParam String query,
            @RequestParam long from,
            @RequestParam long to) {
        
        logger.info("Requisição de métricas: query={}, from={}, to={}", query, from, to);
        
        Map<String, Object> metrics = datadogService.getMetrics(query, from, to);
        
        if (metrics.isEmpty()) {
            return ResponseEntity.noContent().build();
        }
        
        return ResponseEntity.ok(metrics);
    }

    /**
     * Endpoint para obter logs
     * 
     * GET /api/observability/datadog/logs?query=status:error&from=1234567890000&to=1234567900000
     */
    @GetMapping("/logs")
    public ResponseEntity<Map<String, Object>> getLogs(
            @RequestParam String query,
            @RequestParam long from,
            @RequestParam long to) {
        
        logger.info("Requisição de logs: query={}, from={}, to={}", query, from, to);
        
        Map<String, Object> logs = datadogService.getLogs(query, from, to);
        
        if (logs.isEmpty()) {
            return ResponseEntity.noContent().build();
        }
        
        return ResponseEntity.ok(logs);
    }

    /**
     * Endpoint para obter dados de um dashboard específico
     * 
     * GET /api/observability/datadog/dashboard/abc123def456
     */
    @GetMapping("/dashboard/{dashboardId}")
    public ResponseEntity<Map<String, Object>> getDashboard(
            @PathVariable String dashboardId) {
        
        logger.info("Requisição de dashboard: id={}", dashboardId);
        
        Map<String, Object> dashboard = datadogService.getDashboardData(dashboardId);
        
        if (dashboard.isEmpty()) {
            return ResponseEntity.noContent().build();
        }
        
        return ResponseEntity.ok(dashboard);
    }

    /**
     * Endpoint para obter SLOs (Service Level Objectives)
     * 
     * GET /api/observability/datadog/slos
     */
    @GetMapping("/slos")
    public ResponseEntity<Map<String, Object>> getSLOs() {
        
        logger.info("Requisição de SLOs");
        
        Map<String, Object> slos = datadogService.getSLOs();
        
        if (slos.isEmpty()) {
            return ResponseEntity.noContent().build();
        }
        
        return ResponseEntity.ok(slos);
    }

    /**
     * Endpoint de health check para verificar se Datadog está configurado
     * 
     * GET /api/observability/datadog/health
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        
        boolean isConfigured = datadogService.isConfigured();
        
        Map<String, Object> response = new HashMap<>();
        response.put("status", isConfigured ? "UP" : "DOWN");
        response.put("datadog_configured", isConfigured);
        response.put("timestamp", System.currentTimeMillis());
        
        return ResponseEntity.ok(response);
    }
}
