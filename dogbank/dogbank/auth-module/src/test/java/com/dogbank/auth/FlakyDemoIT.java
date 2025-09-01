package com.dogbank.auth;

import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FlakyDemoIT {
  @Test
  void flaky_by_design() {
    // Só roda a demo quando DEMO_FLAKY=1. Caso contrário, "skip".
    boolean demoOn = "1".equals(System.getenv("DEMO_FLAKY"));
    Assumptions.assumeTrue(demoOn, "flaky demo desabilitada");

    // ~50% de chance de falhar para demonstrar flakiness
    double r = Math.random();
    assertTrue(r > 0.5, "Flaky demo: r=" + r);
  }
}
