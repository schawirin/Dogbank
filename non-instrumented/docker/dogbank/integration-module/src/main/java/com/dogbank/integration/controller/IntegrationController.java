package com.dogbank.integration.controller;

import com.dogbank.integration.service.ExternalIntegrationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/integration")
public class IntegrationController {

    @Autowired
    private ExternalIntegrationService integrationService;

    @GetMapping("/pix")
    public String simulatePix(@RequestParam String chavePix) {
        // Chama o serviço que simula a integração com o sistema Pix
        return integrationService.simulatePixIntegration(chavePix);
    }
}
