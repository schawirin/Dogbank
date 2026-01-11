-- =============================================================================
-- Script de inicialização do banco DogBank
-- =============================================================================
-- Este script cria as tabelas e insere dados de teste
-- Inclui contas com saldo alto para testar regra COAF (>= R$ 50.000,00)
-- =============================================================================

-- Criar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- =============================================================================
-- DATADOG DATABASE MONITORING (DBM) - Criar usuário
-- =============================================================================
-- Drop and recreate to ensure correct password
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'datadog') THEN
        DROP ROLE datadog;
    END IF;
END
$$;

CREATE USER datadog WITH PASSWORD 'datadog_password';
GRANT pg_monitor TO datadog;
GRANT SELECT ON pg_stat_database TO datadog;
GRANT SELECT ON pg_stat_activity TO datadog;

-- Grant access to dogbank database
GRANT CONNECT ON DATABASE dogbank TO datadog;
GRANT USAGE ON SCHEMA public TO datadog;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO datadog;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO datadog;

-- =============================================================================
-- CONFIGURAÇÕES DE PERFORMANCE
-- =============================================================================
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;

-- =============================================================================
-- CRIAR TABELAS
-- =============================================================================

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    cpf VARCHAR(14) NOT NULL UNIQUE,
    senha VARCHAR(100) NOT NULL,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    chave_pix VARCHAR(100) UNIQUE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de contas
CREATE TABLE IF NOT EXISTS contas (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL,
    numero_conta VARCHAR(20) NOT NULL UNIQUE,
    saldo NUMERIC(12,2) NOT NULL DEFAULT 10000.00,
    banco VARCHAR(50) NOT NULL DEFAULT 'DOG BANK',
    user_name VARCHAR(100),
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    
    CONSTRAINT uk_usuario UNIQUE (usuario_id)
);

-- Tabela de transações PIX
CREATE TABLE IF NOT EXISTS transacoes_pix (
    id SERIAL PRIMARY KEY,
    conta_origem INT NOT NULL,
    conta_destino INT NOT NULL,
    valor_transacionado NUMERIC(12,2) NOT NULL,
    chave_pix_destino VARCHAR(100),
    data_transacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'CONCLUIDA',

    CONSTRAINT fk_conta_origem
        FOREIGN KEY (conta_origem)
        REFERENCES contas (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_conta_destino
        FOREIGN KEY (conta_destino)
        REFERENCES contas (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- =============================================================================
-- LIMPAR DADOS EXISTENTES (para garantir dados corretos)
-- =============================================================================
TRUNCATE TABLE transacoes_pix CASCADE;
TRUNCATE TABLE contas CASCADE;
TRUNCATE TABLE usuarios CASCADE;

-- =============================================================================
-- INSERIR USUÁRIOS DE TESTE
-- =============================================================================
-- Inclui usuários com saldo alto para testar regra COAF (transações >= R$ 50.000,00)
INSERT INTO usuarios (cpf, senha, nome, email, chave_pix) VALUES
('12345678915', '123456', 'Vitoria Itadori', 'vitoria.itadori@dogbank.com', 'vitoria.itadori@dogbank.com'),
('98765432101', '123456', 'Pedro Silva', 'pedro.silva@dogbank.com', 'pedro.silva@dogbank.com'),
('45678912302', '123456', 'João Santos', 'joao.santos@dogbank.com', 'joao.santos@dogbank.com'),
('78912345603', '123456', 'Emiliano Costa', 'emiliano.costa@dogbank.com', 'emiliano.costa@dogbank.com'),
('32165498704', '123456', 'Eliane Oliveira', 'eliane.oliveira@dogbank.com', 'eliane.oliveira@dogbank.com'),
('65498732105', '123456', 'Patricia Souza', 'patricia.souza@dogbank.com', 'patricia.souza@dogbank.com'),
('15975385206', '123456', 'Renato Almeida', 'renato.almeida@dogbank.com', 'renato.almeida@dogbank.com'),
('66666666666', '123456', 'Usuario Teste', 'teste@dogbank.com', 'teste@dogbank.com'),
-- Usuários com saldo alto para testar COAF
('11122233344', '123456', 'Carlos Magnata', 'carlos.magnata@dogbank.com', 'carlos.magnata@dogbank.com'),
('55566677788', '123456', 'Maria Empresaria', 'maria.empresaria@dogbank.com', 'maria.empresaria@dogbank.com');

-- =============================================================================
-- CRIAR CONTAS COM SALDO INICIAL
-- =============================================================================
-- Contas com saldo alto (>= R$ 100.000,00) para testar regra COAF
-- COAF: Transações >= R$ 50.000,00 devem ser reportadas
INSERT INTO contas (usuario_id, numero_conta, saldo, banco, user_name) VALUES
((SELECT id FROM usuarios WHERE cpf='12345678915'), '0001-9', 10000.00, 'DOG BANK', 'Vitoria Itadori'),
((SELECT id FROM usuarios WHERE cpf='98765432101'), '0002-1', 15000.00, 'Banco do Brasil', 'Pedro Silva'),
((SELECT id FROM usuarios WHERE cpf='45678912302'), '0003-2', 8500.00, 'Itau', 'Joao Santos'),
((SELECT id FROM usuarios WHERE cpf='78912345603'), '0004-3', 12000.00, 'Santander', 'Emiliano Costa'),
((SELECT id FROM usuarios WHERE cpf='32165498704'), '0005-4', 9500.00, 'Bradesco', 'Eliane Oliveira'),
((SELECT id FROM usuarios WHERE cpf='65498732105'), '0006-5', 20000.00, 'Nubank', 'Patricia Souza'),
((SELECT id FROM usuarios WHERE cpf='15975385206'), '0007-6', 7500.00, 'DOG BANK', 'Renato Almeida'),
((SELECT id FROM usuarios WHERE cpf='66666666666'), '0008-7', 50000.00, 'DOG BANK', 'Usuario Teste'),
-- Contas com saldo alto para testar COAF (>= R$ 100.000,00)
((SELECT id FROM usuarios WHERE cpf='11122233344'), '0009-8', 250000.00, 'DOG BANK', 'Carlos Magnata'),
((SELECT id FROM usuarios WHERE cpf='55566677788'), '0010-9', 500000.00, 'DOG BANK', 'Maria Empresaria');

-- =============================================================================
-- VERIFICAR E ATUALIZAR SALDOS (garantia extra)
-- =============================================================================
UPDATE contas SET saldo = 10000.00, banco = 'DOG BANK', user_name = 'Vitoria Itadori' WHERE numero_conta = '0001-9';
UPDATE contas SET saldo = 15000.00, banco = 'Banco do Brasil', user_name = 'Pedro Silva' WHERE numero_conta = '0002-1';
UPDATE contas SET saldo = 8500.00, banco = 'Itau', user_name = 'Joao Santos' WHERE numero_conta = '0003-2';
UPDATE contas SET saldo = 12000.00, banco = 'Santander', user_name = 'Emiliano Costa' WHERE numero_conta = '0004-3';
UPDATE contas SET saldo = 9500.00, banco = 'Bradesco', user_name = 'Eliane Oliveira' WHERE numero_conta = '0005-4';
UPDATE contas SET saldo = 20000.00, banco = 'Nubank', user_name = 'Patricia Souza' WHERE numero_conta = '0006-5';
UPDATE contas SET saldo = 7500.00, banco = 'DOG BANK', user_name = 'Renato Almeida' WHERE numero_conta = '0007-6';
UPDATE contas SET saldo = 50000.00, banco = 'DOG BANK', user_name = 'Usuario Teste' WHERE numero_conta = '0008-7';
-- Contas com saldo alto para testar COAF
UPDATE contas SET saldo = 250000.00, banco = 'DOG BANK', user_name = 'Carlos Magnata' WHERE numero_conta = '0009-8';
UPDATE contas SET saldo = 500000.00, banco = 'DOG BANK', user_name = 'Maria Empresaria' WHERE numero_conta = '0010-9';

-- =============================================================================
-- INSERIR TRANSAÇÕES DE EXEMPLO
-- =============================================================================
INSERT INTO transacoes_pix (conta_origem, conta_destino, valor_transacionado, chave_pix_destino, status) VALUES
((SELECT id FROM contas WHERE numero_conta='0001-9'), (SELECT id FROM contas WHERE numero_conta='0002-1'), 100.00, 'pedro.silva@dogbank.com', 'CONCLUIDA'),
((SELECT id FROM contas WHERE numero_conta='0008-7'), (SELECT id FROM contas WHERE numero_conta='0001-9'), 500.00, 'vitoria.itadori@dogbank.com', 'CONCLUIDA'),
((SELECT id FROM contas WHERE numero_conta='0002-1'), (SELECT id FROM contas WHERE numero_conta='0003-2'), 250.00, 'joao.santos@dogbank.com', 'CONCLUIDA'),
((SELECT id FROM contas WHERE numero_conta='0006-5'), (SELECT id FROM contas WHERE numero_conta='0008-7'), 1000.00, 'teste@dogbank.com', 'CONCLUIDA'),
((SELECT id FROM contas WHERE numero_conta='0004-3'), (SELECT id FROM contas WHERE numero_conta='0005-4'), 350.00, 'eliane.oliveira@dogbank.com', 'CONCLUIDA');

-- =============================================================================
-- CRIAR ÍNDICES PARA PERFORMANCE
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_usuarios_cpf ON usuarios(cpf);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_contas_numero_conta ON contas(numero_conta);
CREATE INDEX IF NOT EXISTS idx_contas_usuario_id ON contas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_data ON transacoes_pix(data_transacao);
CREATE INDEX IF NOT EXISTS idx_transacoes_conta_origem ON transacoes_pix(conta_origem);
CREATE INDEX IF NOT EXISTS idx_transacoes_conta_destino ON transacoes_pix(conta_destino);

-- =============================================================================
-- LOG DE SUCESSO E VERIFICAÇÃO
-- =============================================================================
DO $$
DECLARE
    v_usuarios INT;
    v_contas INT;
    v_transacoes INT;
    v_saldo_total NUMERIC;
    v_contas_coaf INT;
BEGIN
    SELECT COUNT(*) INTO v_usuarios FROM usuarios;
    SELECT COUNT(*) INTO v_contas FROM contas;
    SELECT COUNT(*) INTO v_transacoes FROM transacoes_pix;
    SELECT COALESCE(SUM(saldo), 0) INTO v_saldo_total FROM contas;
    SELECT COUNT(*) INTO v_contas_coaf FROM contas WHERE saldo >= 50000;
    
    RAISE NOTICE '';
    RAISE NOTICE '╔═══════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║   ✅ DogBank - Inicialização Concluída com Sucesso!          ║';
    RAISE NOTICE '╠═══════════════════════════════════════════════════════════════╣';
    RAISE NOTICE '║   📊 Usuários criados: %                                      ', v_usuarios;
    RAISE NOTICE '║   💳 Contas criadas: %                                        ', v_contas;
    RAISE NOTICE '║   💸 Transações de exemplo: %                                 ', v_transacoes;
    RAISE NOTICE '║   💰 Saldo total no sistema: R$ %                         ', v_saldo_total;
    RAISE NOTICE '║   🏛️ Contas com saldo >= R$ 50k (COAF): %                     ', v_contas_coaf;
    RAISE NOTICE '╚═══════════════════════════════════════════════════════════════╝';
    RAISE NOTICE '';
    RAISE NOTICE '📋 CONTAS PARA TESTAR REGRA COAF (transações >= R$ 50.000,00):';
    RAISE NOTICE '   - Carlos Magnata: R$ 250.000,00 (CPF: 11122233344)';
    RAISE NOTICE '   - Maria Empresaria: R$ 500.000,00 (CPF: 55566677788)';
    RAISE NOTICE '';
END $$;

-- Verificação final dos saldos
SELECT 
    u.nome,
    u.cpf,
    c.numero_conta,
    c.banco,
    c.saldo,
    CASE WHEN c.saldo >= 50000 THEN '🏛️ COAF' ELSE '' END as coaf_eligible
FROM usuarios u
JOIN contas c ON u.id = c.usuario_id
ORDER BY c.saldo DESC;
