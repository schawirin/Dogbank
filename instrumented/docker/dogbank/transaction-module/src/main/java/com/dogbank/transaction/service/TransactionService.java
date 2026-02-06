package com.dogbank.transaction.service;

import com.dogbank.transaction.entity.Transaction;
import com.dogbank.transaction.repository.TransactionRepository;
import com.dogbank.transaction.model.AccountModel;
import com.dogbank.transaction.model.UserModel;
import com.dogbank.transaction.metrics.PixBusinessMetrics;
import com.dogbank.transaction.event.PixTransactionEvent;

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
    
    @Autowired
    private PixBusinessMetrics pixMetrics;
    
    @Autowired(required = false)
    private KafkaProducerService kafkaProducerService;

    @Autowired(required = false)
    private RabbitMQProducerService rabbitMQProducerService;

    @Autowired(required = false)
    private EventPublisherService eventPublisherService;

    @Value("${kafka.enabled:false}")
    private boolean kafkaEnabled;

    @Value("${rabbitmq.enabled:false}")
    private boolean rabbitmqEnabled;
    
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
        BigDecimal saldoAntes = null;
        
        // Registra início da transação PIX
        pixMetrics.registrarPixIniciado(accountOriginId, pixKeyDestination, amount);
        
        // Adiciona contexto ao MDC para logs estruturados
        MDC.put("chave_pix", pixKeyDestination);
        MDC.put("valor", amount.toString());
        MDC.put("valor_numerico", amount.toString());
        MDC.put("conta_origem_id", accountOriginId.toString());
        MDC.put("tipo_chave", identificarTipoChave(pixKeyDestination));
        
        try {
            // Origem
            AccountModel origin = getAccountById(accountOriginId);
            if (origin == null) {
                long durationMs = calcularDuracao(startedAt);
                pixMetrics.registrarPixFalha(accountOriginId, pixKeyDestination, amount, 
                    "CONTA_ORIGEM_NAO_ENCONTRADA", "Conta de origem não encontrada", "VALIDACAO", durationMs);
                MDC.put("evento", "PIX_ERRO");
                MDC.put("status_transacao", "ERRO_CONTA_ORIGEM_NAO_ENCONTRADA");
                log.error("Conta de origem não encontrada");
                throw new RuntimeException("Conta de origem não encontrada");
            }
            
            saldoAntes = origin.getBalance();
            MDC.put("remetente_id", origin.getId().toString());
            MDC.put("remetente_banco", origin.getBanco() != null ? origin.getBanco() : "DogBank");
            MDC.put("saldo_antes", saldoAntes.toString());
            
            // Destino
            UserModel userDest = getUserByPixKey(pixKeyDestination);
            if (userDest == null) {
                long durationMs = calcularDuracao(startedAt);
                pixMetrics.registrarPixFalha(accountOriginId, pixKeyDestination, amount, 
                    "CHAVE_PIX_NAO_ENCONTRADA", "Chave Pix de destino não encontrada", "VALIDACAO", durationMs);
                MDC.put("evento", "PIX_ERRO");
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
                long durationMs = calcularDuracao(startedAt);
                pixMetrics.registrarPixFalha(accountOriginId, pixKeyDestination, amount, 
                    "CONTA_DESTINO_NAO_ENCONTRADA", "Conta de destino não encontrada", "VALIDACAO", durationMs);
                MDC.put("evento", "PIX_ERRO");
                MDC.put("status_transacao", "ERRO_CONTA_DESTINO_NAO_ENCONTRADA");
                log.error("Conta de destino não encontrada");
                throw new RuntimeException("Conta de destino não encontrada");
            }
            
            String bancoDestino = dest.getBanco() != null ? dest.getBanco() : "DogBank";
            MDC.put("destinatario_id", dest.getId().toString());
            MDC.put("destinatario_banco", bancoDestino);
            MDC.put("status_transacao", "VALIDANDO_BANCO_CENTRAL");
            
            log.info("PIX iniciado - Transferencia de conta {} para chave {}", accountOriginId, pixKeyDestination);
            
            // Validação Banco Central com métricas
            long bcStartTime = System.currentTimeMillis();
            Map<String, Object> validation = validarPixNoBancoCentral(pixKeyDestination, amount);
            long bcDuration = System.currentTimeMillis() - bcStartTime;
            
            boolean bcAprovado = "APPROVED".equals(validation.get("status"));
            String bcCodigo = (String) validation.getOrDefault("errorCode", "OK");
            pixMetrics.registrarValidacaoBancoCentral(pixKeyDestination, amount, bcAprovado, bcCodigo, bcDuration);
            
            if (!bcAprovado) {
                String error = (String) validation.get("error");
                String errorCode = (String) validation.get("errorCode");
                long durationMs = calcularDuracao(startedAt);
                pixMetrics.registrarPixFalha(accountOriginId, pixKeyDestination, amount, 
                    errorCode != null ? errorCode : "BC_REJEITADO", 
                    error != null ? error : "Erro desconhecido", "BANCO_CENTRAL", durationMs);
                MDC.put("evento", "PIX_ERRO");
                MDC.put("status_transacao", "REJEITADO_BANCO_CENTRAL");
                MDC.put("erro_codigo", errorCode != null ? errorCode : "DESCONHECIDO");
                MDC.put("erro_mensagem", error != null ? error : "Erro desconhecido");
                log.error("Banco Central rejeitou a transação - Code: {}, Error: {}", errorCode, error);
                throw new RuntimeException("Erro no Banco Central: " + error);
            }
            
            MDC.put("status_transacao", "BANCO_CENTRAL_APROVADO");
            MDC.put("tempo_banco_central_ms", String.valueOf(bcDuration));
            log.info("Validação do Banco Central aprovada em {}ms", bcDuration);
            
            // Verifica saldo
            if (origin.getBalance().compareTo(amount) < 0) {
                long durationMs = calcularDuracao(startedAt);
                pixMetrics.registrarSaldoInsuficiente(accountOriginId, origin.getBalance(), amount);
                pixMetrics.registrarPixFalha(accountOriginId, pixKeyDestination, amount, 
                    "SALDO_INSUFICIENTE", "Saldo insuficiente para realizar a transferência", "SALDO", durationMs);
                MDC.put("evento", "PIX_ERRO");
                MDC.put("status_transacao", "ERRO_SALDO_INSUFICIENTE");
                MDC.put("saldo_disponivel", origin.getBalance().toString());
                log.error("Saldo insuficiente - Disponível: R$ {}, Necessário: R$ {}", origin.getBalance(), amount);
                throw new RuntimeException("Saldo insuficiente");
            }
            
            // Atualiza saldos
            BigDecimal saldoDepois = origin.getBalance().subtract(amount);
            BigDecimal saldoDestinoDepois = dest.getBalance().add(amount);
            updateAccountBalance(origin.getId(), saldoDepois);
            updateAccountBalance(dest.getId(), saldoDestinoDepois);

            MDC.put("saldo_depois", saldoDepois.toString());
            
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
            tx.setReceiverBank(bancoDestino);
            tx.setSenderName("Remetente");
            tx.setSenderBankCode("DogBank");
            tx.setSenderAgency("");
            tx.setSenderAccountNumber("");
            tx.setDescription("PIX para " + userDest.getNome());
            
            Transaction saved = transactionRepository.save(tx);

            long durationMs = calcularDuracao(startedAt);

            // Publica eventos para event-driven architecture (CQRS - Command completed)
            if (eventPublisherService != null) {
                try {
                    // Evento 1: Saldo origem atualizado
                    eventPublisherService.publishBalanceUpdated(
                        accountOriginId,
                        amount.negate(), // delta negativo (saída)
                        saldoDepois,
                        "pix_transfer_out",
                        saved.getId().toString()
                    );

                    // Evento 2: Saldo destino atualizado
                    eventPublisherService.publishBalanceUpdated(
                        dest.getId(),
                        amount, // delta positivo (entrada)
                        saldoDestinoDepois,
                        "pix_transfer_in",
                        saved.getId().toString()
                    );

                    // Evento 3: PIX concluído
                    eventPublisherService.publishPixCompleted(
                        saved.getId().toString(),
                        accountOriginId,
                        dest.getId(),
                        amount,
                        pixKeyDestination,
                        saldoDepois,
                        saldoDestinoDepois
                    );

                    log.info("✅ Published event-driven events for PIX transaction {}", saved.getId());
                } catch (Exception e) {
                    log.warn("⚠️ Failed to publish event-driven events (non-blocking): {}", e.getMessage());
                }
            }

            // Registra sucesso com métricas completas
            pixMetrics.registrarPixSucesso(
                saved.getId(),
                accountOriginId,
                dest.getId(),
                pixKeyDestination,
                amount,
                userDest.getNome(),
                bancoDestino,
                saldoAntes,
                saldoDepois,
                durationMs
            );
            
            MDC.put("evento", "PIX_CONCLUIDO");
            MDC.put("status_transacao", "CONCLUIDO");
            MDC.put("transaction_id", saved.getId().toString());
            MDC.put("duracao_ms", String.valueOf(durationMs));
            MDC.put("pix_sucesso", "true");
            
            log.info("PIX concluído com sucesso - ID: {}, Valor: R$ {}, Destino: {}, Banco: {}, Duração: {}ms", 
                saved.getId(), amount, userDest.getNome(), bancoDestino, durationMs);
            
            // Send event to message queues for async processing (notifications, audit, fraud detection, etc.)
            if ((kafkaEnabled && kafkaProducerService != null) || (rabbitmqEnabled && rabbitMQProducerService != null)) {
                // Create event once, reuse for both Kafka and RabbitMQ
                PixTransactionEvent event = PixTransactionEvent.builder()
                    .transactionId(saved.getId().toString())
                    .sourceAccountId(accountOriginId.toString())
                    .destinationPixKey(pixKeyDestination)
                    .amount(amount)
                    .description("PIX para " + userDest.getNome())
                    .createdAt(java.time.LocalDateTime.now())
                    .status("COMPLETED")
                    .retryCount(0)
                    .correlationId(UUID.randomUUID().toString())
                    .sourceUserName("Remetente")
                    .sourceUserEmail("")
                    .destinationUserName(userDest.getNome())
                    .destinationUserEmail(userDest.getEmail() != null ? userDest.getEmail() : "")
                    .build();
                
                // Send to Kafka for event sourcing and analytics
                if (kafkaEnabled && kafkaProducerService != null) {
                    try {
                        kafkaProducerService.sendPixTransaction(event);
                        log.info("📤 PIX event sent to Kafka for transaction {}", saved.getId());
                    } catch (Exception kafkaEx) {
                        log.warn("⚠️ Failed to send PIX event to Kafka (non-blocking): {}", kafkaEx.getMessage());
                    }
                }
                
                // Send to RabbitMQ for FIFO processing (fraud detection, etc.)
                if (rabbitmqEnabled && rabbitMQProducerService != null) {
                    try {
                        rabbitMQProducerService.publishPixTransaction(event);
                        log.info("🐰 PIX event sent to RabbitMQ for transaction {}", saved.getId());
                    } catch (Exception rabbitEx) {
                        log.warn("⚠️ Failed to send PIX event to RabbitMQ (non-blocking): {}", rabbitEx.getMessage());
                    }
                }
            }
            
            return saved;
            
        } catch (RuntimeException e) {
            if (MDC.getCopyOfContextMap() == null || !MDC.getCopyOfContextMap().containsKey("status_transacao")) {
                MDC.put("evento", "PIX_ERRO");
                MDC.put("status_transacao", "ERRO_GENERICO");
            }
            MDC.put("erro_mensagem", e.getMessage());
            MDC.put("pix_falha", "true");
            log.error("Falha na transferência PIX: {}", e.getMessage(), e);
            throw e;
        } finally {
            MDC.clear();
        }
    }
    
    private long calcularDuracao(ZonedDateTime startedAt) {
        return ZonedDateTime.now().toInstant().toEpochMilli() - startedAt.toInstant().toEpochMilli();
    }
    
    private String identificarTipoChave(String chavePix) {
        if (chavePix == null) return "DESCONHECIDO";
        
        if (chavePix.matches("\\d{11}")) {
            return "CPF";
        } else if (chavePix.matches("\\d{14}")) {
            return "CNPJ";
        } else if (chavePix.contains("@")) {
            return "EMAIL";
        } else if (chavePix.matches("\\+?\\d{10,15}")) {
            return "TELEFONE";
        } else if (chavePix.matches("[a-f0-9\\-]{32,36}")) {
            return "CHAVE_ALEATORIA";
        }
        return "OUTRO";
    }
    
    /**
     * ⚠️⚠️⚠️ VULNERÁVEL A SQL INJECTION - PROPOSITAL PARA DEMO DATADOG ASM ⚠️⚠️⚠️
     * 
     * Exemplos de SQL Injection que funcionam:
     * 
     * 1. Bypass (retorna todos os usuários):
     *    GET /api/transactions/validate-pix-key?pixKey=' OR '1'='1
     * 
     * 2. Buscar por outro campo:
     *    GET /api/transactions/validate-pix-key?pixKey=' OR email='pedro.silva@dogbank.com' --
     * 
     * 3. UNION SELECT (6 colunas):
     *    GET /api/transactions/validate-pix-key?pixKey=' UNION SELECT nome, email, cpf, saldo::text, banco, chave_pix FROM usuarios u JOIN contas c ON u.id=c.usuario_id--
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getBalanceByPixKeyVulnerable(String pixKey) {
        log.warn("⚠️ [SECURITY DEMO] Executando query VULNERÁVEL a SQL Injection");
        log.warn("⚠️ [INPUT]: {}", pixKey);
        
        MDC.put("security_event", "sql_injection_vulnerable_endpoint");
        MDC.put("input_pix_key", pixKey);
        MDC.put("endpoint", "/api/transactions/validate-pix-key");
        
        try {
            // ⚠️ VULNERÁVEL: Concatenação direta de string sem sanitização
            String sql = "SELECT u.nome, u.email, u.cpf, c.saldo, c.banco, u.chave_pix " +
                         "FROM usuarios u " +
                         "JOIN contas c ON u.id = c.usuario_id " +
                         "WHERE u.chave_pix = '" + pixKey + "'";
            
            log.info("📝 [SQL QUERY EXECUTADA]: {}", sql);
            
            @SuppressWarnings("unchecked")
            javax.persistence.Query query = entityManager.createNativeQuery(sql);
            List<Object[]> results = query.getResultList();
            
            if (results.isEmpty()) {
                log.warn("❌ Nenhum resultado encontrado para: {}", pixKey);
                Map<String, Object> emptyResponse = new HashMap<>();
                emptyResponse.put("valid", false);
                emptyResponse.put("message", "Chave PIX não encontrada");
                emptyResponse.put("query_executed", sql);
                return emptyResponse;
            }
            
            // Se retornou múltiplos resultados (SQL Injection bem sucedido!)
            if (results.size() > 1) {
                log.error("🚨 [SQL INJECTION DETECTADO] Query retornou {} registros!", results.size());
                
                Map<String, Object> response = new HashMap<>();
                response.put("valid", true);
                response.put("sql_injection_detected", true);
                response.put("records_leaked", results.size());
                response.put("query_executed", sql);
                
                // Retorna TODOS os dados vazados (para demonstração)
                List<Map<String, Object>> leakedData = new ArrayList<>();
                for (Object[] row : results) {
                    Map<String, Object> userData = new HashMap<>();
                    userData.put("nome", row[0] != null ? row[0].toString() : "N/A");
                    userData.put("email", row[1] != null ? row[1].toString() : "N/A");
                    userData.put("cpf", row[2] != null ? row[2].toString() : "N/A"); // CPF completo vazado!
                    userData.put("saldo", row[3] != null ? "R$ " + row[3].toString() : "R$ 0,00");
                    userData.put("banco", row[4] != null ? row[4].toString() : "DogBank");
                    userData.put("chave_pix", row[5] != null ? row[5].toString() : "N/A");
                    leakedData.add(userData);
                }
                response.put("leaked_data", leakedData);
                
                return response;
            }
            
            // Resultado único (comportamento normal ou injection direcionado)
            Object[] row = results.get(0);
            
            Map<String, Object> response = new HashMap<>();
            response.put("valid", true);
            response.put("nome", row[0] != null ? row[0].toString() : "N/A");
            response.put("email", row[1] != null ? row[1].toString() : "N/A");
            response.put("cpf", row[2] != null ? maskCpf(row[2].toString()) : "N/A");
            response.put("saldo", row[3] != null ? "R$ " + row[3].toString() : "R$ 0,00");
            response.put("banco", row[4] != null ? row[4].toString() : "DogBank");
            response.put("chave_pix", row[5] != null ? row[5].toString() : "N/A");
            
            log.info("✅ Dados encontrados para: {}", row[0]);
            
            return response;
            
        } catch (Exception e) {
            log.error("💥 Erro ao executar query SQL: {} | Input: {}", e.getMessage(), pixKey);
            MDC.put("error_type", e.getClass().getSimpleName());
            
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("valid", false);
            errorResponse.put("error", "Erro de SQL: " + e.getMessage());
            errorResponse.put("sql_error", true);
            errorResponse.put("input_received", pixKey);
            
            return errorResponse;
        } finally {
            MDC.clear();
        }
    }
    
    public Optional<Transaction> findById(Long id) {
        return transactionRepository.findById(id);
    }
    
    public List<Transaction> listarTransacoesPorConta(Long accountId) {
        // Busca transações onde a conta é origem OU destino (enviadas e recebidas)
        return transactionRepository.findAllByAccountId(accountId);
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
        if (len == 11) {
            return pixKey.substring(0, 3) + "*****" + pixKey.substring(8);
        }
        if (len >= 4) {
            return pixKey.substring(0, 2) + "****" + pixKey.substring(len - 2);
        }
        return "****";
    }
    
    // ==================== Métodos de integração com outros serviços ====================
    
    private AccountModel getAccountById(Long accountId) {
        try {
            String url = accountServiceUrl + "/api/accounts/" + accountId;
            ResponseEntity<AccountModel> response = restTemplate.getForEntity(url, AccountModel.class);
            return response.getBody();
        } catch (Exception e) {
            log.error("Erro ao buscar conta por ID: {}", e.getMessage());
            return null;
        }
    }
    
    private AccountModel getAccountByUserId(Long userId) {
        try {
            String url = accountServiceUrl + "/api/accounts/user/" + userId;
            ResponseEntity<AccountModel> response = restTemplate.getForEntity(url, AccountModel.class);
            return response.getBody();
        } catch (Exception e) {
            log.error("Erro ao buscar conta por userId: {}", e.getMessage());
            return null;
        }
    }
    
    private UserModel getUserByPixKey(String pixKey) {
        try {
            String url = authServiceUrl + "/api/auth/pix-key/" + pixKey;
            ResponseEntity<UserModel> response = restTemplate.getForEntity(url, UserModel.class);
            return response.getBody();
        } catch (Exception e) {
            log.error("Erro ao buscar usuário por chave PIX: {}", e.getMessage());
            return null;
        }
    }
    
    private void updateAccountBalance(Long accountId, BigDecimal newBalance) {
        try {
            String url = accountServiceUrl + "/api/accounts/" + accountId + "/balance";
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            
            Map<String, Object> body = new HashMap<>();
            body.put("balance", newBalance);
            
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
            restTemplate.exchange(url, HttpMethod.PUT, request, Void.class);
        } catch (Exception e) {
            log.error("Erro ao atualizar saldo da conta {}: {}", accountId, e.getMessage());
            throw new RuntimeException("Erro ao atualizar saldo: " + e.getMessage());
        }
    }
    
    @SuppressWarnings("unchecked")
    private Map<String, Object> validarPixNoBancoCentral(String pixKey, BigDecimal amount) {
        try {
            String url = bancoCentralUrl + "/pix/validate";
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            
            Map<String, Object> body = new HashMap<>();
            body.put("pixKey", pixKey);
            body.put("amount", amount);
            
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
            ResponseEntity<Map> response = restTemplate.postForEntity(url, request, Map.class);
            
            return response.getBody() != null ? response.getBody() : Map.of("status", "APPROVED");
        } catch (HttpClientErrorException | HttpServerErrorException e) {
            log.error("Erro HTTP do Banco Central: {} - {}", e.getStatusCode(), e.getResponseBodyAsString());
            return Map.of(
                "status", "REJECTED",
                "error", "Erro de comunicação com Banco Central",
                "errorCode", "BC_HTTP_ERROR"
            );
        } catch (ResourceAccessException e) {
            log.error("Banco Central indisponível: {}", e.getMessage());
            return Map.of(
                "status", "REJECTED",
                "error", "Banco Central indisponível",
                "errorCode", "BC_UNAVAILABLE"
            );
        } catch (Exception e) {
            log.error("Erro inesperado ao validar PIX: {}", e.getMessage());
            return Map.of(
                "status", "REJECTED",
                "error", "Erro interno",
                "errorCode", "INTERNAL_ERROR"
            );
        }
    }

    /**
     * Valida senha do usuário chamando o auth-service
     */
    public boolean validarSenha(Long accountId, String senha) {
        try {
            // Buscar user_id da conta
            AccountModel account = getAccountById(accountId);
            if (account == null) {
                log.error("❌ Conta não encontrada para validação de senha: {}", accountId);
                return false;
            }

            Long userId = account.getUsuarioId();

            // Chamar auth-service para validar senha
            String url = authServiceUrl + "/api/users/" + userId + "/validate-password";
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, Object> body = new HashMap<>();
            body.put("senha", senha);

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

            try {
                ResponseEntity<Map> response = restTemplate.postForEntity(url, request, Map.class);
                Map<String, Object> responseBody = response.getBody();

                if (responseBody != null && Boolean.TRUE.equals(responseBody.get("valid"))) {
                    log.info("✅ Senha validada com sucesso para user_id={}", userId);
                    return true;
                } else {
                    log.warn("⚠️ Senha inválida para user_id={}", userId);
                    return false;
                }
            } catch (HttpClientErrorException e) {
                if (e.getStatusCode() == HttpStatus.UNAUTHORIZED) {
                    log.warn("⚠️ Senha incorreta para user_id={}", userId);
                    return false;
                }
                throw e;
            }

        } catch (Exception e) {
            log.error("❌ Erro ao validar senha: {}", e.getMessage());
            return false;
        }
    }
}
