package com.dogbank.transaction;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = {
    "com.dogbank.transaction", 
    "com.dogbank.account", 
    "com.dogbank.auth"
})
public class TransactionModuleApplication {
    public static void main(String[] args) {
        SpringApplication.run(TransactionModuleApplication.class, args);
    }
}
