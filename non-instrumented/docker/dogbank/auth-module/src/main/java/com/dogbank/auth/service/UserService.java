package com.dogbank.auth.service;

import com.dogbank.auth.entity.User;
import com.dogbank.auth.repository.UserRepository;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Service responsável pela lógica de negócio dos usuários
 * Implementa validações, segurança e integração com repository
 */
@Service
public class UserService {

    private static final Logger logger = LogManager.getLogger(UserService.class);

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private BCryptPasswordEncoder passwordEncoder;

    /**
     * Busca usuário por ID
     */
    @Transactional(readOnly = true)
    public Optional<User> findById(Long id) {
        Map<String, Object> logData = new HashMap<>();
        logData.put("method", "findById");
        logData.put("userId", id);
        logData.put("timestamp", System.currentTimeMillis());

        try {
            logger.debug("Buscando usuário por ID: {}", logData);
            
            Optional<User> user = userRepository.findById(id);
            
            if (user.isPresent()) {
                logData.put("status", "found");
                logger.debug("Usuário encontrado: {}", logData);
            } else {
                logData.put("status", "not_found");
                logger.debug("Usuário não encontrado: {}", logData);
            }
            
            return user;
            
        } catch (Exception e) {
            logData.put("status", "error");
            logData.put("error_message", e.getMessage());
            logger.error("Erro ao buscar usuário por ID: {}", logData, e);
            throw e;
        }
    }

    /**
     * Busca usuário por chave PIX
     * MÉTODO CRÍTICO - Usado pelo transaction-module para validar destinatário
     */
    @Transactional(readOnly = true)
    public Optional<User> findByChavePix(String chavePix) {
        Map<String, Object> logData = new HashMap<>();
        logData.put("method", "findByChavePix");
        logData.put("chavePix", chavePix);
        logData.put("timestamp", System.currentTimeMillis());

        try {
            // Validação básica
            if (chavePix == null || chavePix.trim().isEmpty()) {
                logData.put("status", "invalid_input");
                logger.warn("Chave PIX inválida ou vazia: {}", logData);
                return Optional.empty();
            }

            logger.debug("Buscando usuário por chave PIX: {}", logData);
            
            Optional<User> user = userRepository.findByChavePix(chavePix.trim());
            
            if (user.isPresent()) {
                logData.put("status", "found");
                logData.put("userId", user.get().getId());
                logger.info("Usuário encontrado por chave PIX: {}", logData);
            } else {
                logData.put("status", "not_found");
                logger.info("Usuário não encontrado para chave PIX: {}", logData);
            }
            
            return user;
            
        } catch (Exception e) {
            logData.put("status", "error");
            logData.put("error_message", e.getMessage());
            logger.error("Erro ao buscar usuário por chave PIX: {}", logData, e);
            throw e;
        }
    }

    /**
     * Busca usuário por CPF
     */
    @Transactional(readOnly = true)
    public Optional<User> findByCpf(String cpf) {
        Map<String, Object> logData = new HashMap<>();
        logData.put("method", "findByCpf");
        logData.put("cpf", cpf);
        logData.put("timestamp", System.currentTimeMillis());

        try {
            // Validação básica
            if (cpf == null || cpf.trim().isEmpty()) {
                logData.put("status", "invalid_input");
                logger.warn("CPF inválido ou vazio: {}", logData);
                return Optional.empty();
            }

            // Remove formatação do CPF
            String cpfLimpo = cpf.replaceAll("[^0-9]", "");
            
            logger.debug("Buscando usuário por CPF: {}", logData);
            
            Optional<User> user = userRepository.findByCpf(cpfLimpo);
            
            if (user.isPresent()) {
                logData.put("status", "found");
                logData.put("userId", user.get().getId());
                logger.debug("Usuário encontrado por CPF: {}", logData);
            } else {
                logData.put("status", "not_found");
                logger.debug("Usuário não encontrado para CPF: {}", logData);
            }
            
            return user;
            
        } catch (Exception e) {
            logData.put("status", "error");
            logData.put("error_message", e.getMessage());
            logger.error("Erro ao buscar usuário por CPF: {}", logData, e);
            throw e;
        }
    }

    /**
     * Busca usuário por email
     */
    @Transactional(readOnly = true)
    public Optional<User> findByEmail(String email) {
        Map<String, Object> logData = new HashMap<>();
        logData.put("method", "findByEmail");
        logData.put("email", email);
        logData.put("timestamp", System.currentTimeMillis());

        try {
            // Validação básica
            if (email == null || email.trim().isEmpty()) {
                logData.put("status", "invalid_input");
                logger.warn("Email inválido ou vazio: {}", logData);
                return Optional.empty();
            }

            logger.debug("Buscando usuário por email: {}", logData);
            
            Optional<User> user = userRepository.findByEmail(email.trim().toLowerCase());
            
            if (user.isPresent()) {
                logData.put("status", "found");
                logData.put("userId", user.get().getId());
                logger.debug("Usuário encontrado por email: {}", logData);
            } else {
                logData.put("status", "not_found");
                logger.debug("Usuário não encontrado para email: {}", logData);
            }
            
            return user;
            
        } catch (Exception e) {
            logData.put("status", "error");
            logData.put("error_message", e.getMessage());
            logger.error("Erro ao buscar usuário por email: {}", logData, e);
            throw e;
        }
    }

    /**
     * Valida senha do usuário
     * MÉTODO CRÍTICO - Usado para autenticação em transações
     */
    public boolean validatePassword(Long userId, String rawPassword) {
        Map<String, Object> logData = new HashMap<>();
        logData.put("method", "validatePassword");
        logData.put("userId", userId);
        logData.put("timestamp", System.currentTimeMillis());

        try {
            // Validações básicas
            if (userId == null || rawPassword == null || rawPassword.isEmpty()) {
                logData.put("status", "invalid_input");
                logger.warn("Parâmetros inválidos para validação de senha: {}", logData);
                return false;
            }

            logger.debug("Validando senha do usuário: {}", logData);
            
            Optional<User> userOpt = userRepository.findById(userId);
            
            if (userOpt.isEmpty()) {
                logData.put("status", "user_not_found");
                logger.warn("Usuário não encontrado para validação de senha: {}", logData);
                return false;
            }

            User user = userOpt.get();
            boolean isValid = passwordEncoder.matches(rawPassword, user.getSenha());
            
            if (isValid) {
                logData.put("status", "success");
                logger.info("Senha validada com sucesso: {}", logData);
            } else {
                logData.put("status", "invalid_password");
                logger.warn("Senha inválida: {}", logData);
            }
            
            return isValid;
            
        } catch (Exception e) {
            logData.put("status", "error");
            logData.put("error_message", e.getMessage());
            logger.error("Erro ao validar senha: {}", logData, e);
            return false;
        }
    }

    /**
     * Cria novo usuário
     */
    @Transactional
    public User createUser(User user) {
        Map<String, Object> logData = new HashMap<>();
        logData.put("method", "createUser");
        logData.put("email", user.getEmail());
        logData.put("timestamp", System.currentTimeMillis());

        try {
            logger.info("Criando novo usuário: {}", logData);

            // Valida se email já existe
            if (userRepository.findByEmail(user.getEmail()).isPresent()) {
                logData.put("status", "email_already_exists");
                logger.warn("Email já cadastrado: {}", logData);
                throw new IllegalArgumentException("Email já cadastrado");
            }

            // Valida se CPF já existe
            if (userRepository.findByCpf(user.getCpf()).isPresent()) {
                logData.put("status", "cpf_already_exists");
                logger.warn("CPF já cadastrado: {}", logData);
                throw new IllegalArgumentException("CPF já cadastrado");
            }

            // Valida se chave PIX já existe (se fornecida)
            if (user.getChavePix() != null && !user.getChavePix().isEmpty()) {
                if (userRepository.findByChavePix(user.getChavePix()).isPresent()) {
                    logData.put("status", "pix_key_already_exists");
                    logger.warn("Chave PIX já cadastrada: {}", logData);
                    throw new IllegalArgumentException("Chave PIX já cadastrada");
                }
            }

            // Encripta a senha antes de salvar
            user.setSenha(passwordEncoder.encode(user.getSenha()));

            User savedUser = userRepository.save(user);
            
            logData.put("status", "success");
            logData.put("userId", savedUser.getId());
            logger.info("Usuário criado com sucesso: {}", logData);

            return savedUser;
            
        } catch (Exception e) {
            logData.put("status", "error");
            logData.put("error_message", e.getMessage());
            logger.error("Erro ao criar usuário: {}", logData, e);
            throw e;
        }
    }

    /**
     * Atualiza chave PIX do usuário
     */
    @Transactional
    public User updateChavePix(Long userId, String novaChavePix) {
        Map<String, Object> logData = new HashMap<>();
        logData.put("method", "updateChavePix");
        logData.put("userId", userId);
        logData.put("timestamp", System.currentTimeMillis());

        try {
            logger.info("Atualizando chave PIX do usuário: {}", logData);

            Optional<User> userOpt = userRepository.findById(userId);
            
            if (userOpt.isEmpty()) {
                logData.put("status", "user_not_found");
                logger.warn("Usuário não encontrado: {}", logData);
                throw new IllegalArgumentException("Usuário não encontrado");
            }

            // Valida se a nova chave PIX já está em uso
            if (novaChavePix != null && !novaChavePix.isEmpty()) {
                Optional<User> existingUser = userRepository.findByChavePix(novaChavePix);
                if (existingUser.isPresent() && !existingUser.get().getId().equals(userId)) {
                    logData.put("status", "pix_key_already_exists");
                    logger.warn("Chave PIX já cadastrada para outro usuário: {}", logData);
                    throw new IllegalArgumentException("Chave PIX já cadastrada");
                }
            }

            User user = userOpt.get();
            user.setChavePix(novaChavePix);
            
            User updatedUser = userRepository.save(user);
            
            logData.put("status", "success");
            logger.info("Chave PIX atualizada com sucesso: {}", logData);

            return updatedUser;
            
        } catch (Exception e) {
            logData.put("status", "error");
            logData.put("error_message", e.getMessage());
            logger.error("Erro ao atualizar chave PIX: {}", logData, e);
            throw e;
        }
    }
}