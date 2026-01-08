package com.dogbank.auth.repository;

import com.dogbank.auth.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
class UserRepositoryTest {

  @Autowired
  private UserRepository userRepository;

  @Test
  void deve_salvar_e_buscar_por_cpf() {
    User u = new User();
    u.setCpf("99999999999");
    u.setSenha("123456");
    u.setNome("Teste Repo");
    u.setEmail("repo@test.com");
    u.setChavePix("repo@test.com");
    userRepository.save(u);

    Optional<User> found = userRepository.findByCpf("99999999999");
    assertThat(found).isPresent();
    assertThat(found.get().getNome()).isEqualTo("Teste Repo");
  }
}
