package com.dogbank.integration.datadog;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

/**
 * Testes para DatadogService
 */
public class DatadogServiceTest {

    @Mock
    private RestTemplate restTemplate;

    @InjectMocks
    private DatadogService datadogService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        
        // Configurar properties
        ReflectionTestUtils.setField(datadogService, "datadogEnabled", true);
        ReflectionTestUtils.setField(datadogService, "datadogApiKey", "test-api-key");
        ReflectionTestUtils.setField(datadogService, "datadogAppKey", "test-app-key");
        ReflectionTestUtils.setField(datadogService, "datadogApiUrl", "https://api.datadoghq.com");
    }

    @Test
    void testGetMetricsSuccess() {
        // Arrange
        Map<String, Object> expectedResponse = new HashMap<>();
        expectedResponse.put("status", "ok");
        expectedResponse.put("series", new Object[]{});

        when(restTemplate.exchange(
                anyString(),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(Map.class)
        )).thenReturn(new ResponseEntity<>(expectedResponse, HttpStatus.OK));

        // Act
        Map<String, Object> result = datadogService.getMetrics("avg:system.cpu{*}", 1000, 2000);

        // Assert
        assertNotNull(result);
        assertEquals("ok", result.get("status"));
    }

    @Test
    void testGetLogsSuccess() {
        // Arrange
        Map<String, Object> expectedResponse = new HashMap<>();
        expectedResponse.put("data", new Object[]{});
        expectedResponse.put("meta", new Object[]{});

        when(restTemplate.exchange(
                anyString(),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(Map.class)
        )).thenReturn(new ResponseEntity<>(expectedResponse, HttpStatus.OK));

        // Act
        Map<String, Object> result = datadogService.getLogs("status:error", 1000000, 2000000);

        // Assert
        assertNotNull(result);
        assertTrue(result.containsKey("data"));
    }

    @Test
    void testGetDashboardSuccess() {
        // Arrange
        Map<String, Object> expectedResponse = new HashMap<>();
        expectedResponse.put("id", "abc123");
        expectedResponse.put("title", "Test Dashboard");

        when(restTemplate.exchange(
                anyString(),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(Map.class)
        )).thenReturn(new ResponseEntity<>(expectedResponse, HttpStatus.OK));

        // Act
        Map<String, Object> result = datadogService.getDashboardData("abc123");

        // Assert
        assertNotNull(result);
        assertEquals("abc123", result.get("id"));
        assertEquals("Test Dashboard", result.get("title"));
    }

    @Test
    void testGetSLOsSuccess() {
        // Arrange
        Map<String, Object> expectedResponse = new HashMap<>();
        expectedResponse.put("data", new Object[]{});

        when(restTemplate.exchange(
                anyString(),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(Map.class)
        )).thenReturn(new ResponseEntity<>(expectedResponse, HttpStatus.OK));

        // Act
        Map<String, Object> result = datadogService.getSLOs();

        // Assert
        assertNotNull(result);
        assertTrue(result.containsKey("data"));
    }

    @Test
    void testDisabledDatadog() {
        // Arrange
        ReflectionTestUtils.setField(datadogService, "datadogEnabled", false);

        // Act
        Map<String, Object> result = datadogService.getMetrics("avg:system.cpu{*}", 1000, 2000);

        // Assert
        assertTrue(result.isEmpty());
    }

    @Test
    void testIsConfigured() {
        // Act
        boolean result = datadogService.isConfigured();

        // Assert
        assertTrue(result);
    }

    @Test
    void testIsNotConfigured() {
        // Arrange
        ReflectionTestUtils.setField(datadogService, "datadogApiKey", "");

        // Act
        boolean result = datadogService.isConfigured();

        // Assert
        assertFalse(result);
    }
}
