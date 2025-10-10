package com.dogbank.transaction.service;

import com.dogbank.transaction.entity.Transaction;
import com.dogbank.transaction.repository.TransactionRepository;
import com.dogbank.transaction.model.AccountModel;
import com.dogbank.transaction.model.UserModel;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class TransactionService {
    
    private static final Logger log = LoggerFactory.getLogger(TransactionService.class);
    
    @Autowired
    private TransactionRepository transactionRepository;
    
    @Autowired
    private RestTemplate restTemplate;
    
    @PersistenceContext
    private EntityManager entityManager;
    
    @Value("${bancocentral.api.url}")
    private String bancoCentralUrl;
    
    @Value("${account.api.url}")
    private String accountServiceUrl;
    
    @Value("${auth.api.url}")
    private String authServiceUrl;
    
    @Transactional
    public Transaction transferirPix(Long accountOriginId, String pixKeyDestination, BigDecimal amount) {
        ZonedDateTime startedAt = ZonedDateTime.now();
        
        // Adiciona contexto ao MDC para logs estruturados
        MDC.put("chave_pix", pixKeyDestination);
        MDC.put("valor", amount.toString());
        MDC.put("conta_origem_id", accountOriginId.toString());
        
        try {
            // Origem
            AccountModel origin = getAccountById(accountOriginId);
            if (origin == null) {
                MDC.put("status_transacao", "ERRO_CONTA_ORIGEM_NAO_ENCONTRADA");
                log.error("Conta de origem não encontrada");
                throw new RuntimeException("Conta de origem não encontrada");
            }
            
            MDC.put("remetente_id", origin.getId().toString());
            
            // Destino
            UserModel userDest = getUserByPixKey(pixKeyDestination);
            if (userDest == null) {
                MDC.put("status_transacao", "ERRO_CHAVE_PIX_NAO_ENCONTRADA");
                log.error("Chave Pix de destino não encontrada");
                throw new RuntimeException("Chave Pix de destino não encontrada");
            }
            
            MDC.put("destinatario_nome", userDest.getNome());
            if (userDest.getCpf() != null) {
                MDC.put("destinatario_cpf", maskCpf(userDest.getCpf()));
            }
            
            AccountModel dest = getAccountByUserId(userDest.getId());
            if (dest == null) {
                MDC.put("status_transacao", "ERRO_CONTA_DESTINO_NAO_ENCONTRADA");
                log.error("Conta de destino não encontrada");
                throw new RuntimeException("Conta de destino não encontrada");
            }
            
            MDC.put("destinatario_id", dest.getId().toString());
            MDC.put("status_transacao", "VALIDANDO_BANCO_CENTRAL");
            
            log.info("PIX iniciado - Transferencia de conta {} para chave {}", accountOriginId, pixKeyDestination);
            
            // Validação Banco Central
            Map<String, Object> validation = validarPixNoBancoCentral(pixKeyDestination, amount);
            
            if (!"APPROVED".equals(validation.get("status"))) {
                String error = (String) validation.get("error");
                String errorCode = (String) validation.get("errorCode");
                MDC.put("status_transacao", "REJEITADO_BANCO_CENTRAL");
                MDC.put("erro_codigo", errorCode != null ? errorCode : "DESCONHECIDO");
                MDC.put("erro_mensagem", error != null ? error : "Erro desconhecido");
                log.error("Banco Central rejeitou a transação - Code: {}, Error: {}", errorCode, error);
                throw new RuntimeException("Erro no Banco Central: " + error);
            }
            
            MDC.put("status_transacao", "BANCO_CENTRAL_APROVADO");
            log.info("Validação do Banco Central aprovada");
            
            // Verifica saldo
            if (origin.getBalance().compareTo(amount) < 0) {
                MDC.put("status_transacao", "ERRO_SALDO_INSUFICIENTE");
                MDC.put("saldo_disponivel", origin.getBalance().toString());
                log.error("Saldo insuficiente - Disponível: R$ {}, Necessário: R$ {}", origin.getBalance(), amount);
                throw new RuntimeException("Saldo insuficiente");
            }
            
            // Atualiza saldos
            updateAccountBalance(origin.getId(), origin.getBalance().subtract(amount));
            updateAccountBalance(dest.getId(), dest.getBalance().add(amount));
            
            // Persiste transação
            Transaction tx = new Transaction();
            tx.setAccountOriginId(accountOriginId);
            tx.setAccountDestinationId(dest.getId());
            tx.setAmount(amount);
            tx.setType("PIX");
            tx.setStartedAt(startedAt);
            tx.setCompletedAt(ZonedDateTime.now());
            tx.setPixKeyDestination(pixKeyDestination);
            tx.setReceiverName(userDest.getNome());
            tx.setReceiverBank("DogBank");
            tx.setSenderName("Remetente");
            tx.setSenderBankCode("DogBank");
            tx.setSenderAgency("");
            tx.setSenderAccountNumber("");
            tx.setDescription("PIX para " + userDest.getNome());
            
            Transaction saved = transactionRepository.save(tx);
            
            long durationMs = ZonedDateTime.now().toInstant().toEpochMilli() - 
                             startedAt.toInstant().toEpochMilli();
            
            MDC.put("status_transacao", "CONCLUIDO");
            MDC.put("transaction_id", saved.getId().toString());
            MDC.put("duracao_ms", String.valueOf(durationMs));
            
            log.info("PIX concluído com sucesso - ID: {}, Duração: {}ms", saved.getId(), durationMs);
            
            return saved;
            
        } catch (RuntimeException e) {
            if (MDC.getCopyOfContextMap() == null || !MDC.getCopyOfContextMap().containsKey("status_transacao")) {
                MDC.put("status_transacao", "ERRO_GENERICO");
            }
            MDC.put("erro_mensagem", e.getMessage());
            log.error("Falha na transferência PIX: {}", e.getMessage(), e);
            throw e;
        } finally {
            MDC.clear();
        }
    }
    
    /**
     * ⚠️⚠️⚠️ VULNERÁVEL A SQL INJECTION - PROPOSITAL PARA DEMO DATADOG ASM ⚠️⚠️⚠️
     * 
     * Este método é INTENCIONALMENTE vulnerável a SQL Injection
     * para fins de demonstração do Datadog Application Security Monitoring (ASM).
     * 
     * NUNCA use concatenação de strings em queries SQL em produção!
     * Sempre use Prepared Statements ou JPA/Hibernate.
     * 
     * Exemplos de payloads maliciosos:
     * - ' OR '1'='1
     * - ' UNION SELECT nome, senha, cpf, email, banco, chave_pix FROM usuarios--
     * - ' OR pg_sleep(5)--
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getBalanceByPixKeyVulnerable(String pixKey) {
        log.warn("⚠️ [SECURITY DEMO] Executando query VULNERÁVEL a SQL Injection");
        log.warn("⚠️ [INPUT]: {}", pixKey);
        
        MDC.put("security_event", "sql_injection_vulnerable_endpoint");
        MDC.put("input_pix_key", pixKey);
        MDC.put("endpoint", "/api/transactions/validate-pix-key");
        
        try {
            // 🚨 VULNERABILIDADE PROPOSITAL: Concatenação direta sem prepared statement
            String sql = "SELECT u.nome, u.email, u.cpf, c.saldo, c.banco, u.chave_pix " +
                         "FROM usuarios u " +
                         "JOIN contas c ON u.id = c.usuario_id " +
                         "WHERE u.chave_pix = '" + pixKey + "'";
            
            log.info("📝 [SQL QUERY]: {}", sql);
            
            @SuppressWarnings("unchecked")
            javax.persistence.Query query = entityManager.createNativeQuery(sql);
            List<Object[]> results = query.getResultList();
            
            if (results.isEmpty()) {
                log.warn("❌ Nenhum resultado encontrado para: {}", pixKey);
                return Map.of(
                    "valid", false,
                    "message", "Chave PIX não encontrada"
                );
            }
            
            Object[] row = results.get(0);
            
            Map<String, Object> response = new HashMap<>();
            response.put("valid", true);
            response.put("nome", row[0] != null ? row[0] : "N/A");
            response.put("email", row[1] != null ? row[1] : "N/A");
            response.put("cpf", row[2] != null ? maskCpf(row[2].toString()) : "N/A");
            response.put("saldo", row[3] != null ? "R$ " + row[3] : "R$ 0,00");
            response.put("banco", row[4] != null ? row[4] : "DogBank");
            response.put("chave_pix", row[5] != null ? row[5] : "N/A");
            
            log.info("✅ Dados encontrados para: {}", row[0]);
            
            return response;
            
        } catch (Exception e) {
            log.error("💥 Erro ao executar query SQL: {} | Input: {}", e.getMessage(), pixKey);
            MDC.put("error_type", e.getClass().getSimpleName());
            
            // Retorna erro que pode revelar informações do banco (outra vulnerabilidade!)
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("valid", false);
            errorResponse.put("error", "Erro de SQL: " + e.getMessage());
            errorResponse.put("sql_error", true);
            
            return errorResponse;
        } finally {
            MDC.clear();
        }
    }
    
    public Optional<Transaction> findById(Long id) {
        return transactionRepository.findById(id);
    }
    
    public List<Transaction> listarTransacoesPorConta(Long accountId) {
        return transactionRepository.findAllByAccountOriginIdOrderByDateDesc(accountId);
    }
    
    public String generateAuthCode(Transaction tx) {
        return UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }
    
    public String extractInitials(String fullName) {
        if (fullName == null || fullName.isBlank()) return "";
        return Stream.of(fullName.split("\\s+"))
                     .filter(s -> !s.isBlank())
                     .map(s -> s.substring(0, 1).toUpperCase())
                     .limit(2)
                     .collect(Collectors.joining());
    }
    
    public String maskCpf(String pixKey) {
        if (pixKey == null) return "";
        if (pixKey.contains("@")) {
            String[] parts = pixKey.split("@", 2);
            return parts[0].charAt(0) + "****@" + parts[1];
        }
        int len = pixKey.length();
        if (len <= 4) return pixKey;
        return "****" + pixKey.substring(len - 4);
    }
    
    @SuppressWarnings("unchecked")
    private Map<String, Object> validarPixNoBancoCentral(String pixKey, BigDecimal amount) {
        Map<String, Object> req = new HashMap<>();
        req.put("pixKey", pixKey);
        req.put("amount", amount);
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(req, headers);
        
        try {
            log.debug("Chamando Banco Central - URL: {}, Chave: {}, Valor: R$ {}", bancoCentralUrl, pixKey, amount);
            
            ResponseEntity<Map> resp = restTemplate.exchange(
                bancoCentralUrl, 
                HttpMethod.POST, 
                entity, 
                Map.class
            );
            
            Map<String, Object> body = resp.getBody();
            log.debug("Resposta do Banco Central: {}", body);
            
            return body;
            
        } catch (HttpClientErrorException | HttpServerErrorException e) {
            log.error("Erro HTTP do Banco Central: {} - {}", e.getStatusCode(), e.getResponseBodyAsString());
            Map<String, Object> err = new HashMap<>();
            err.put("status", "FAILED");
            err.put("error", "Erro HTTP: " + e.getStatusCode());
            err.put("errorCode", "HTTP-" + e.getStatusCode().value());
            return err;
            
        } catch (ResourceAccessException e) {
            log.error("Timeout ao conectar com Banco Central: {}", e.getMessage());
            Map<String, Object> err = new HashMap<>();
            err.put("status", "FAILED");
            err.put("error", "Timeout ao conectar com Banco Central");
            err.put("errorCode", "PIX-TIMEOUT");
            return err;
            
        } catch (Exception e) {
            log.error("Erro inesperado ao chamar Banco Central: {}", e.getMessage(), e);
            Map<String, Object> err = new HashMap<>();
            err.put("status", "FAILED");
            err.put("error", "Erro na validação externa: " + e.getMessage());
            err.put("errorCode", "PIX-ERRO-GENERICO");
            return err;
        }
    }
    
    private AccountModel getAccountById(Long accountId) {
        AccountModel account = new AccountModel();
        account.setId(accountId);
        account.setBalance(new BigDecimal("10000.00"));
        return account;
    }
    
    private UserModel getUserByPixKey(String pixKey) {
        UserModel user = new UserModel();
        user.setId(1L);
        user.setNome("Usuário Destino");
        user.setChavePix(pixKey);
        user.setCpf("12345678900");
        return user;
    }
    
    private AccountModel getAccountByUserId(Long userId) {
        AccountModel account = new AccountModel();
        account.setId(2L);
        account.setUsuarioId(userId);
        account.setBalance(new BigDecimal("500.00"));
        return account;
    }
    
    private void updateAccountBalance(Long accountId, BigDecimal newBalance) {
        log.debug("Saldo atualizado - Conta: {}, Novo saldo: R$ {}", accountId, newBalance);
    }
}