-- =============================================================================
-- DogBank - Schema para Autorizador e Ledger
-- =============================================================================
-- Este script cria as tabelas necessárias para os novos módulos:
-- - Autorizador: Regras de autorização e logs de fraude
-- - Ledger: Lançamentos contábeis e saldos
-- =============================================================================

-- =============================================================================
-- AUTORIZADOR MODULE
-- =============================================================================

-- Tabela de regras de autorização
CREATE TABLE IF NOT EXISTS authorization_rules (
    id SERIAL PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL UNIQUE,
    rule_type VARCHAR(50) NOT NULL, -- 'LIMIT', 'TIME', 'LOCATION', 'DEVICE'
    rule_value JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de limites por usuário
CREATE TABLE IF NOT EXISTS user_limits (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id),
    daily_limit DECIMAL(15, 2) DEFAULT 50000.00,
    single_transaction_limit DECIMAL(15, 2) DEFAULT 10000.00,
    daily_used DECIMAL(15, 2) DEFAULT 0.00,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de logs de autorização
CREATE TABLE IF NOT EXISTS authorization_logs (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(100),
    usuario_id INTEGER REFERENCES usuarios(id),
    amount DECIMAL(15, 2) NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'APPROVED', 'DENIED', 'PENDING'
    denial_reason VARCHAR(255),
    rules_evaluated JSONB,
    risk_score DECIMAL(5, 2),
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_fingerprint VARCHAR(255),
    location_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de padrões de fraude
CREATE TABLE IF NOT EXISTS fraud_patterns (
    id SERIAL PRIMARY KEY,
    pattern_name VARCHAR(100) NOT NULL,
    pattern_type VARCHAR(50) NOT NULL, -- 'VELOCITY', 'AMOUNT', 'LOCATION', 'TIME'
    pattern_definition JSONB NOT NULL,
    risk_weight DECIMAL(3, 2) DEFAULT 1.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para Autorizador
CREATE INDEX IF NOT EXISTS idx_auth_logs_usuario ON authorization_logs(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auth_logs_created ON authorization_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_auth_logs_status ON authorization_logs(status);
CREATE INDEX IF NOT EXISTS idx_user_limits_usuario ON user_limits(usuario_id);

-- =============================================================================
-- LEDGER MODULE
-- =============================================================================

-- Tabela de contas contábeis
CREATE TABLE IF NOT EXISTS ledger_accounts (
    id SERIAL PRIMARY KEY,
    account_code VARCHAR(20) NOT NULL UNIQUE,
    account_name VARCHAR(100) NOT NULL,
    account_type VARCHAR(20) NOT NULL, -- 'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'
    parent_account_id INTEGER REFERENCES ledger_accounts(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de lançamentos contábeis (partidas dobradas)
CREATE TABLE IF NOT EXISTS ledger_entries (
    id SERIAL PRIMARY KEY,
    entry_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    transaction_id VARCHAR(100) NOT NULL,
    description TEXT,
    reference_type VARCHAR(50), -- 'PIX', 'TED', 'DEPOSIT', 'WITHDRAWAL'
    reference_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'POSTED', -- 'PENDING', 'POSTED', 'REVERSED'
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de linhas de lançamento (débito/crédito)
CREATE TABLE IF NOT EXISTS ledger_entry_lines (
    id SERIAL PRIMARY KEY,
    entry_id INTEGER NOT NULL REFERENCES ledger_entries(id),
    ledger_account_id INTEGER NOT NULL REFERENCES ledger_accounts(id),
    debit_amount DECIMAL(15, 2) DEFAULT 0.00,
    credit_amount DECIMAL(15, 2) DEFAULT 0.00,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Garantir que cada linha tem débito OU crédito, não ambos
    CONSTRAINT check_debit_credit CHECK (
        (debit_amount > 0 AND credit_amount = 0) OR 
        (credit_amount > 0 AND debit_amount = 0)
    )
);

-- Tabela de saldos contábeis (cache para performance)
CREATE TABLE IF NOT EXISTS ledger_balances (
    id SERIAL PRIMARY KEY,
    ledger_account_id INTEGER NOT NULL REFERENCES ledger_accounts(id) UNIQUE,
    debit_total DECIMAL(15, 2) DEFAULT 0.00,
    credit_total DECIMAL(15, 2) DEFAULT 0.00,
    balance DECIMAL(15, 2) DEFAULT 0.00,
    last_entry_date TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de auditoria
CREATE TABLE IF NOT EXISTS ledger_audit_trail (
    id SERIAL PRIMARY KEY,
    entry_id INTEGER REFERENCES ledger_entries(id),
    action VARCHAR(20) NOT NULL, -- 'CREATE', 'UPDATE', 'REVERSE'
    old_values JSONB,
    new_values JSONB,
    performed_by VARCHAR(100),
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    reason TEXT
);

-- Índices para Ledger
CREATE INDEX IF NOT EXISTS idx_ledger_entries_transaction ON ledger_entries(transaction_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_date ON ledger_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_status ON ledger_entries(status);
CREATE INDEX IF NOT EXISTS idx_ledger_lines_entry ON ledger_entry_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_ledger_lines_account ON ledger_entry_lines(ledger_account_id);
CREATE INDEX IF NOT EXISTS idx_ledger_audit_entry ON ledger_audit_trail(entry_id);

-- =============================================================================
-- DADOS INICIAIS
-- =============================================================================

-- Regras de autorização padrão
INSERT INTO authorization_rules (rule_name, rule_type, rule_value, priority) VALUES
    ('daily_limit', 'LIMIT', '{"type": "daily", "default_limit": 50000}', 1),
    ('single_transaction_limit', 'LIMIT', '{"type": "single", "default_limit": 10000}', 2),
    ('business_hours', 'TIME', '{"start": "06:00", "end": "22:00", "timezone": "America/Sao_Paulo"}', 3),
    ('suspicious_amount', 'AMOUNT', '{"threshold": 5000, "requires_verification": true}', 4)
ON CONFLICT (rule_name) DO NOTHING;

-- Padrões de fraude
INSERT INTO fraud_patterns (pattern_name, pattern_type, pattern_definition, risk_weight) VALUES
    ('high_velocity', 'VELOCITY', '{"max_transactions": 10, "time_window_minutes": 60}', 0.8),
    ('unusual_amount', 'AMOUNT', '{"deviation_multiplier": 3}', 0.6),
    ('new_device', 'DEVICE', '{"first_seen_hours": 24}', 0.4),
    ('location_change', 'LOCATION', '{"max_distance_km": 500, "time_window_hours": 2}', 0.7)
ON CONFLICT DO NOTHING;

-- Contas contábeis padrão
INSERT INTO ledger_accounts (account_code, account_name, account_type) VALUES
    ('1000', 'Ativos', 'ASSET'),
    ('1100', 'Caixa e Equivalentes', 'ASSET'),
    ('1110', 'Conta Corrente', 'ASSET'),
    ('1120', 'Conta Poupança', 'ASSET'),
    ('2000', 'Passivos', 'LIABILITY'),
    ('2100', 'Depósitos de Clientes', 'LIABILITY'),
    ('3000', 'Patrimônio Líquido', 'EQUITY'),
    ('4000', 'Receitas', 'REVENUE'),
    ('4100', 'Receitas de Tarifas', 'REVENUE'),
    ('5000', 'Despesas', 'EXPENSE'),
    ('5100', 'Despesas Operacionais', 'EXPENSE')
ON CONFLICT (account_code) DO NOTHING;

-- Inicializar saldos
INSERT INTO ledger_balances (ledger_account_id, debit_total, credit_total, balance)
SELECT id, 0, 0, 0 FROM ledger_accounts
ON CONFLICT (ledger_account_id) DO NOTHING;

-- =============================================================================
-- FUNÇÕES E TRIGGERS
-- =============================================================================

-- Função para atualizar saldo após inserção de linha
CREATE OR REPLACE FUNCTION update_ledger_balance()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO ledger_balances (ledger_account_id, debit_total, credit_total, balance, last_entry_date)
    VALUES (
        NEW.ledger_account_id,
        NEW.debit_amount,
        NEW.credit_amount,
        NEW.debit_amount - NEW.credit_amount,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (ledger_account_id) DO UPDATE SET
        debit_total = ledger_balances.debit_total + NEW.debit_amount,
        credit_total = ledger_balances.credit_total + NEW.credit_amount,
        balance = ledger_balances.debit_total + NEW.debit_amount - ledger_balances.credit_total - NEW.credit_amount,
        last_entry_date = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar saldo
DROP TRIGGER IF EXISTS trigger_update_ledger_balance ON ledger_entry_lines;
CREATE TRIGGER trigger_update_ledger_balance
    AFTER INSERT ON ledger_entry_lines
    FOR EACH ROW
    EXECUTE FUNCTION update_ledger_balance();

-- Função para resetar limites diários
CREATE OR REPLACE FUNCTION reset_daily_limits()
RETURNS void AS $$
BEGIN
    UPDATE user_limits
    SET daily_used = 0,
        last_reset_date = CURRENT_DATE,
        updated_at = CURRENT_TIMESTAMP
    WHERE last_reset_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- VIEWS
-- =============================================================================

-- View de saldo por conta
CREATE OR REPLACE VIEW v_account_balances AS
SELECT 
    la.account_code,
    la.account_name,
    la.account_type,
    COALESCE(lb.debit_total, 0) as total_debits,
    COALESCE(lb.credit_total, 0) as total_credits,
    COALESCE(lb.balance, 0) as current_balance,
    lb.last_entry_date
FROM ledger_accounts la
LEFT JOIN ledger_balances lb ON la.id = lb.ledger_account_id
WHERE la.is_active = true
ORDER BY la.account_code;

-- View de transações recentes
CREATE OR REPLACE VIEW v_recent_authorizations AS
SELECT 
    al.id,
    al.transaction_id,
    u.nome as usuario_nome,
    u.cpf as usuario_cpf,
    al.amount,
    al.status,
    al.denial_reason,
    al.risk_score,
    al.created_at
FROM authorization_logs al
JOIN usuarios u ON al.usuario_id = u.id
ORDER BY al.created_at DESC
LIMIT 100;

COMMENT ON TABLE authorization_rules IS 'Regras de autorização para transações';
COMMENT ON TABLE user_limits IS 'Limites de transação por usuário';
COMMENT ON TABLE authorization_logs IS 'Log de todas as autorizações';
COMMENT ON TABLE fraud_patterns IS 'Padrões para detecção de fraude';
COMMENT ON TABLE ledger_accounts IS 'Plano de contas contábil';
COMMENT ON TABLE ledger_entries IS 'Lançamentos contábeis';
COMMENT ON TABLE ledger_entry_lines IS 'Linhas de lançamento (débito/crédito)';
COMMENT ON TABLE ledger_balances IS 'Cache de saldos contábeis';
COMMENT ON TABLE ledger_audit_trail IS 'Trilha de auditoria';
