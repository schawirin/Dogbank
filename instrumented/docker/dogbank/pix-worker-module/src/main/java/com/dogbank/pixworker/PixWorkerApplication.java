package com.dogbank.pixworker;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication(exclude = {
    org.springframework.boot.actuate.autoconfigure.metrics.export.datadog.DatadogMetricsExportAutoConfiguration.class
})
@EnableKafka
@EnableAsync
public class PixWorkerApplication {
    public static void main(String[] args) {
        SpringApplication.run(PixWorkerApplication.class, args);
    }
}
