import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class FlakyTest {
  @Test
  void sometimesFails() {
    // ~30% de chance de falhar
    if (Math.random() < 0.3) {
      fail("Simulando flakiness");
    }
  }
}
