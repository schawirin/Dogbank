package com.dogbank.investment.controller;

import com.dogbank.investment.dto.InvestmentPositionResponse;
import com.dogbank.investment.dto.InvestmentProductResponse;
import com.dogbank.investment.dto.InvestmentSubscriptionRequest;
import com.dogbank.investment.service.InvestmentService;
import com.dogbank.investment.service.InvestmentService.SyncFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/investments")
public class InvestmentController {

    private final InvestmentService investmentService;

    public InvestmentController(InvestmentService investmentService) {
        this.investmentService = investmentService;
    }

    @GetMapping("/products")
    public ResponseEntity<List<InvestmentProductResponse>> listProducts() {
        return ResponseEntity.ok(investmentService.listProducts());
    }

    @GetMapping("/account/{accountId}")
    public ResponseEntity<List<InvestmentPositionResponse>> listPositions(@PathVariable Long accountId) {
        return ResponseEntity.ok(investmentService.listPositions(accountId));
    }

    @PostMapping("/subscribe")
    public ResponseEntity<InvestmentPositionResponse> subscribe(@RequestBody InvestmentSubscriptionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(investmentService.subscribe(request));
    }

    @PostMapping("/sync/{positionId}")
    public ResponseEntity<?> syncPosition(@PathVariable String positionId) {
        try {
            return ResponseEntity.ok(investmentService.syncPosition(positionId));
        } catch (SyncFailureException ex) {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("status", "FAILED");
            body.put("errorCode", ex.errorCode);
            body.put("positionId", positionId);
            body.put("message", ex.getMessage());
            return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
        }
    }

    @PostMapping("/sync/run")
    public ResponseEntity<List<InvestmentPositionResponse>> runSync() {
        return ResponseEntity.ok(investmentService.runSync());
    }
}
