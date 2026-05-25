-- =============================================================================
-- DogBank - RDS PostgreSQL Initialization Script
-- =============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Create Datadog monitoring user
CREATE USER datadog WITH PASSWORD 'datadog_monitor_password_change_me';
GRANT pg_monitor TO datadog;
GRANT SELECT ON pg_stat_database TO datadog;
GRANT SELECT ON pg_stat_activity TO datadog;
GRANT SELECT ON pg_stat_statements TO datadog;

-- Create tables
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    cpf VARCHAR(14) NOT NULL UNIQUE,
    senha VARCHAR(100) NOT NULL,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    chave_pix VARCHAR(100) UNIQUE,
    blocked BOOLEAN NOT NULL DEFAULT false,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migration idempotente para clusters ja inicializados (sem 'blocked')
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS blocked BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS contas (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL,
    numero_conta VARCHAR(20) NOT NULL UNIQUE,
    saldo NUMERIC(12,2) NOT NULL DEFAULT 10000.00,
    banco VARCHAR(50) NOT NULL DEFAULT 'DOG BANK',
    user_name VARCHAR(100),
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT uk_usuario UNIQUE (usuario_id)
);

CREATE TABLE IF NOT EXISTS transacoes_pix (
    id SERIAL PRIMARY KEY,
    conta_origem INT NOT NULL,
    conta_destino INT NOT NULL,
    valor_transacionado NUMERIC(12,2) NOT NULL,
    chave_pix_destino VARCHAR(100),
    data_transacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'CONCLUIDA',
    CONSTRAINT fk_conta_origem FOREIGN KEY (conta_origem) REFERENCES contas (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_conta_destino FOREIGN KEY (conta_destino) REFERENCES contas (id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    account_id INT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    transaction_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert test users
INSERT INTO usuarios (cpf, senha, nome, email, chave_pix) VALUES
('12345678915', '123456', 'Vitoria Itadori', 'vitoria.itadori@dogbank.com', 'vitoria.itadori@dogbank.com'),
('98765432101', '123456', 'Pedro Silva', 'pedro.silva@dogbank.com', 'pedro.silva@dogbank.com'),
('45678912302', '123456', 'João Santos', 'joao.santos@dogbank.com', 'joao.santos@dogbank.com'),
('78912345603', '123456', 'Emiliano Costa', 'emiliano.costa@dogbank.com', 'emiliano.costa@dogbank.com'),
('32165498704', '123456', 'Eliane Oliveira', 'eliane.oliveira@dogbank.com', 'eliane.oliveira@dogbank.com'),
('65498732105', '123456', 'Patrícia Souza', 'patricia.souza@dogbank.com', 'patricia.souza@dogbank.com'),
('15975385206', '123456', 'Renato Almeida', 'renato.almeida@dogbank.com', 'renato.almeida@dogbank.com'),
('66666666666', '123456', 'Usuário Teste', 'teste@dogbank.com', 'teste@dogbank.com')
ON CONFLICT (cpf) DO NOTHING;

-- Create accounts
INSERT INTO contas (usuario_id, numero_conta, saldo, banco, user_name) VALUES
((SELECT id FROM usuarios WHERE cpf='12345678915'), '0001-9', 10000.00, 'DOG BANK', 'Vitoria Itadori'),
((SELECT id FROM usuarios WHERE cpf='98765432101'), '0002-1', 15000.00, 'Banco do Brasil', 'Pedro Silva'),
((SELECT id FROM usuarios WHERE cpf='45678912302'), '0003-2', 8500.00, 'Itaú', 'João Santos'),
((SELECT id FROM usuarios WHERE cpf='78912345603'), '0004-3', 12000.00, 'Santander', 'Emiliano Costa'),
((SELECT id FROM usuarios WHERE cpf='32165498704'), '0005-4', 9500.00, 'Bradesco', 'Eliane Oliveira'),
((SELECT id FROM usuarios WHERE cpf='65498732105'), '0006-5', 20000.00, 'Nubank', 'Patrícia Souza'),
((SELECT id FROM usuarios WHERE cpf='15975385206'), '0007-6', 7500.00, 'DOG BANK', 'Renato Almeida'),
((SELECT id FROM usuarios WHERE cpf='66666666666'), '0008-7', 50000.00, 'DOG BANK', 'Usuário Teste')
ON CONFLICT (numero_conta) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_usuarios_cpf ON usuarios(cpf);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_contas_numero_conta ON contas(numero_conta);
CREATE INDEX IF NOT EXISTS idx_contas_usuario_id ON contas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_data ON transacoes_pix(data_transacao);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at);

-- Grant permissions to dogbank user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dogbank;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO dogbank;

-- Verify setup
SELECT 'Database initialized successfully!' as status;
SELECT 'Users created: ' || COUNT(*) as users_count FROM usuarios;
SELECT 'Accounts created: ' || COUNT(*) as accounts_count FROM contas;
