package com.dogbank.auth;

import com.dogbank.auth.entity.User;
import com.dogbank.auth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthLoginIntegrationTest {

  @Autowired MockMvc mvc;
  @Autowired UserRepository userRepository;

  @BeforeEach
  void seed() {
    userRepository.deleteAll();
    User u = new User();
    u.setCpf("12345678915");
    u.setSenha("123456"); // texto puro, conforme README
    u.setNome("Julia Medina");
    u.setEmail("julia.medina@email.com");
    u.setChavePix("julia.pix@email.com");
    userRepository.save(u);
  }

  @Test
  void login_ok() throws Exception {
    mvc.perform(post("/api/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"cpf\":\"12345678915\",\"password\":\"123456\"}"))
       .andExpect(status().isOk())
       // deixa flexível: só exige alguns campos que você mostrou no README
       .andExpect(jsonPath("$.message").exists())
       .andExpect(jsonPath("$.nome").value("Julia Medina"));
  }

  @Test
  void login_falha_senha_incorreta() throws Exception {
    mvc.perform(post("/api/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"cpf\":\"12345678915\",\"password\":\"000000\"}"))
       .andExpect(status().isUnauthorized());
  }
}
