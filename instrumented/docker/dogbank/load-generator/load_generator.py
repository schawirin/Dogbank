#!/usr/bin/env python3
"""
DogBank Load Generator - Gerador de Carga para Transações PIX
=============================================================
Este script simula transações PIX automáticas entre as contas do DogBank
para gerar dados de observabilidade no Datadog.

Cenários:
1. Transações normais (sucesso)
2. Transações de R$ 100,00 (erro - cenário específico)
3. Transações >= R$ 50.000,00 (COAF notification)
4. Transações com saldo insuficiente (erro)
"""

import requests
import random
import time
import logging
import os
from datetime import datetime
from dataclasses import dataclass
from typing import Optional

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Configurações
AUTH_SERVICE_URL = os.getenv('AUTH_SERVICE_URL', 'http://auth-service:8088')
TRANSACTION_SERVICE_URL = os.getenv('TRANSACTION_SERVICE_URL', 'http://transaction-service:8084')
ACCOUNT_SERVICE_URL = os.getenv('ACCOUNT_SERVICE_URL', 'http://account-service:8089')

# Intervalo entre transações (segundos) - Ajustado para não sobrecarregar o sistema
MIN_INTERVAL = float(os.getenv('MIN_INTERVAL', '60'))
MAX_INTERVAL = float(os.getenv('MAX_INTERVAL', '60'))

# Probabilidades de cenários
PROB_NORMAL = float(os.getenv('PROB_NORMAL', '0.50'))       # 50% transações normais
PROB_ERROR_100 = float(os.getenv('PROB_ERROR_100', '0.10'))  # 10% erro R$ 100
PROB_COAF = float(os.getenv('PROB_COAF', '0.05'))           # 5% COAF (>= R$ 50k)
PROB_INSUFFICIENT = float(os.getenv('PROB_INSUFFICIENT', '0.10'))  # 10% saldo insuficiente
# Novos cenários DBM
PROB_DB_LOCK = float(os.getenv('PROB_DB_LOCK', '0.10'))     # 10% DB lock (R$ 7777.77)
PROB_SLOW_QUERY = float(os.getenv('PROB_SLOW_QUERY', '0.08')) # 8% Slow query (R$ 8888.88)
PROB_DEADLOCK = float(os.getenv('PROB_DEADLOCK', '0.05'))   # 5% Deadlock (R$ 9999.99)
PROB_DB_WAIT = float(os.getenv('PROB_DB_WAIT', '0.02'))     # 2% DB wait (R$ 6666.66)


@dataclass
class Account:
    """Representa uma conta do DogBank"""
    cpf: str
    password: str
    name: str
    pix_key: str
    initial_balance: float


# Contas disponíveis para transações (conforme init-db/01-init.sql)
ACCOUNTS = [
    Account("12345678915", "123456", "Vitoria Itadori", "vitoria.itadori@dogbank.com", 10000.00),
    Account("98765432101", "123456", "Pedro Silva", "pedro.silva@dogbank.com", 15000.00),
    Account("45678912302", "123456", "João Santos", "joao.santos@dogbank.com", 8500.00),
    Account("78912345603", "123456", "Emiliano Costa", "emiliano.costa@dogbank.com", 12000.00),
    Account("32165498704", "123456", "Eliane Oliveira", "eliane.oliveira@dogbank.com", 9500.00),
    Account("65498732105", "123456", "Patricia Souza", "patricia.souza@dogbank.com", 20000.00),
    Account("15975385206", "123456", "Renato Almeida", "renato.almeida@dogbank.com", 7500.00),
    Account("66666666666", "123456", "Usuario Teste", "teste@dogbank.com", 50000.00),
    # Contas com saldo alto para testar COAF
    Account("11122233344", "123456", "Carlos Magnata", "carlos.magnata@dogbank.com", 250000.00),
    Account("55566677788", "123456", "Maria Empresaria", "maria.empresaria@dogbank.com", 500000.00),
]


class LoadGenerator:
    """Gerador de carga para transações PIX"""
    
    def __init__(self):
        self.session = requests.Session()
        self.tokens = {}  # Cache de tokens por CPF
        self.stats = {
            'total': 0,
            'success': 0,
            'error_100': 0,
            'coaf': 0,
            'insufficient': 0,
            'db_lock': 0,
            'slow_query': 0,
            'deadlock': 0,
            'db_wait': 0,
            'other_errors': 0
        }

    def login(self, account: Account) -> Optional[dict]:
        """Faz login e retorna os dados do usuário incluindo accountId"""
        if account.cpf in self.tokens:
            return self.tokens[account.cpf]

        try:
            response = self.session.post(
                f"{AUTH_SERVICE_URL}/api/auth/login",
                json={"cpf": account.cpf, "senha": account.password},
                timeout=10
            )

            if response.status_code == 200:
                data = response.json()
                # O backend retorna: {nome, chavePix, accountId}
                if 'accountId' in data:
                    self.tokens[account.cpf] = data
                    logger.info(f"✅ Login OK: {account.name} (AccountID: {data['accountId']})")
                    return data

            logger.warning(f"⚠️ Login falhou para {account.name}: {response.status_code}")
            return None

        except Exception as e:
            logger.error(f"❌ Erro no login de {account.name}: {e}")
            return None
    
    def get_account_id(self, token: str, email: str) -> Optional[int]:
        """Obtém o ID da conta do usuário"""
        try:
            headers = {"Authorization": f"Bearer {token}"}
            response = self.session.get(
                f"{ACCOUNT_SERVICE_URL}/api/accounts/me",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                return data.get('id') or data.get('accountId')
            
            return None
            
        except Exception as e:
            logger.error(f"❌ Erro ao obter conta: {e}")
            return None
    
    def make_pix(self, from_account: Account, to_account: Account, amount: float) -> dict:
        """Realiza uma transação PIX"""
        user_data = self.login(from_account)
        if not user_data:
            return {'success': False, 'error': 'Login failed'}

        try:
            # O login já retorna o accountId
            account_id = user_data.get('accountId')
            if not account_id:
                return {'success': False, 'error': 'Account not found'}

            payload = {
                "accountOriginId": account_id,
                "pixKeyDestination": to_account.pix_key,
                "amount": amount,
                "password": from_account.password,
                "description": "dogbank-load:legacy"
            }

            response = self.session.post(
                f"{TRANSACTION_SERVICE_URL}/api/transactions/pix",
                json=payload,
                timeout=30
            )

            return {
                'success': response.status_code in [200, 201],
                'status_code': response.status_code,
                'response': response.text[:500] if response.text else None
            }

        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def select_scenario(self) -> str:
        """Seleciona um cenário baseado nas probabilidades"""
        rand = random.random()
        cumulative = 0

        scenarios = [
            ('normal', PROB_NORMAL),
            ('error_100', PROB_ERROR_100),
            ('coaf', PROB_COAF),
            ('insufficient', PROB_INSUFFICIENT),
            ('db_lock', PROB_DB_LOCK),
            ('slow_query', PROB_SLOW_QUERY),
            ('deadlock', PROB_DEADLOCK),
            ('db_wait', PROB_DB_WAIT),
        ]

        for scenario, prob in scenarios:
            cumulative += prob
            if rand < cumulative:
                return scenario

        return 'normal'  # default
    
    def generate_transaction(self):
        """Gera uma transação baseada no cenário selecionado"""
        scenario = self.select_scenario()
        self.stats['total'] += 1
        
        if scenario == 'normal':
            # Transação normal: valor aleatório entre R$ 10 e R$ 1000
            # Evita R$ 100 exato
            amount = random.choice([
                random.uniform(10, 99),
                random.uniform(101, 1000)
            ])
            amount = round(amount, 2)
            
            from_account = random.choice(ACCOUNTS[:8])  # Contas normais
            to_account = random.choice([a for a in ACCOUNTS[:8] if a != from_account])
            
            logger.info(f"💰 [{scenario.upper()}] {from_account.name} -> {to_account.name}: R$ {amount:.2f}")
            result = self.make_pix(from_account, to_account, amount)
            
            if result['success']:
                self.stats['success'] += 1
                logger.info(f"   ✅ Sucesso!")
            else:
                self.stats['other_errors'] += 1
                logger.warning(f"   ❌ Erro: {result.get('error') or result.get('status_code')}")
        
        elif scenario == 'error_100':
            # Cenário de erro: exatamente R$ 100,00
            amount = 100.00
            
            from_account = random.choice(ACCOUNTS[:8])
            to_account = random.choice([a for a in ACCOUNTS[:8] if a != from_account])
            
            logger.info(f"🚨 [{scenario.upper()}] {from_account.name} -> {to_account.name}: R$ {amount:.2f} (ERRO ESPERADO)")
            result = self.make_pix(from_account, to_account, amount)
            
            self.stats['error_100'] += 1
            if not result['success']:
                logger.info(f"   ⚠️ Erro esperado: {result.get('status_code')}")
            else:
                logger.warning(f"   ❓ Transação deveria ter falhado mas passou!")
        
        elif scenario == 'coaf':
            # Transação COAF: >= R$ 50.000,00
            amount = random.uniform(50000, 100000)
            amount = round(amount, 2)
            
            # Usa contas com saldo alto
            high_balance_accounts = ACCOUNTS[8:]  # Carlos Magnata e Maria Empresaria
            from_account = random.choice(high_balance_accounts)
            to_account = random.choice([a for a in ACCOUNTS if a != from_account])
            
            logger.info(f"🏛️ [{scenario.upper()}] {from_account.name} -> {to_account.name}: R$ {amount:.2f} (COAF)")
            result = self.make_pix(from_account, to_account, amount)
            
            self.stats['coaf'] += 1
            if result['success']:
                logger.info(f"   ✅ COAF notificado!")
            else:
                logger.warning(f"   ❌ Erro: {result.get('error') or result.get('status_code')}")
        
        elif scenario == 'insufficient':
            # Transação com saldo insuficiente
            amount = 999999.99  # Valor muito alto

            from_account = random.choice(ACCOUNTS[:8])  # Contas com saldo normal
            to_account = random.choice([a for a in ACCOUNTS if a != from_account])

            logger.info(f"💸 [{scenario.upper()}] {from_account.name} -> {to_account.name}: R$ {amount:.2f} (SALDO INSUFICIENTE)")
            result = self.make_pix(from_account, to_account, amount)

            self.stats['insufficient'] += 1
            if not result['success']:
                logger.info(f"   ⚠️ Erro esperado (saldo insuficiente)")
            else:
                logger.warning(f"   ❓ Transação deveria ter falhado!")

        elif scenario == 'db_lock':
            # Transação que causa DB lock
            amount = 7777.77

            from_account = random.choice(ACCOUNTS[:8])
            to_account = random.choice([a for a in ACCOUNTS if a != from_account])

            logger.info(f"🔒 [{scenario.upper()}] {from_account.name} -> {to_account.name}: R$ {amount:.2f} (TRIGGER DB LOCK)")
            result = self.make_pix(from_account, to_account, amount)

            self.stats['db_lock'] += 1
            if result['success']:
                logger.info(f"   🔒 Lock será criado pelo DB Chaos Generator")
            else:
                logger.warning(f"   ❌ Erro: {result.get('status_code')}")

        elif scenario == 'slow_query':
            # Transação que causa slow query
            amount = 8888.88

            from_account = random.choice(ACCOUNTS[:8])
            to_account = random.choice([a for a in ACCOUNTS if a != from_account])

            logger.info(f"🐌 [{scenario.upper()}] {from_account.name} -> {to_account.name}: R$ {amount:.2f} (TRIGGER SLOW QUERY)")
            result = self.make_pix(from_account, to_account, amount)

            self.stats['slow_query'] += 1
            if result['success']:
                logger.info(f"   🐌 Slow query será executada pelo DB Chaos Generator")
            else:
                logger.warning(f"   ❌ Erro: {result.get('status_code')}")

        elif scenario == 'deadlock':
            # Transação que causa deadlock
            amount = 9999.99

            from_account = random.choice(ACCOUNTS[:8])
            to_account = random.choice([a for a in ACCOUNTS if a != from_account])

            logger.info(f"💀 [{scenario.upper()}] {from_account.name} -> {to_account.name}: R$ {amount:.2f} (TRIGGER DEADLOCK)")
            result = self.make_pix(from_account, to_account, amount)

            self.stats['deadlock'] += 1
            if result['success']:
                logger.info(f"   💀 Deadlock será criado pelo DB Chaos Generator")
            else:
                logger.warning(f"   ❌ Erro: {result.get('status_code')}")

        else:  # db_wait
            # Transação que causa waiting query
            amount = 6666.66

            from_account = random.choice(ACCOUNTS[:8])
            to_account = random.choice([a for a in ACCOUNTS if a != from_account])

            logger.info(f"⏰ [{scenario.upper()}] {from_account.name} -> {to_account.name}: R$ {amount:.2f} (TRIGGER DB WAIT)")
            result = self.make_pix(from_account, to_account, amount)

            self.stats['db_wait'] += 1
            if result['success']:
                logger.info(f"   ⏰ Waiting query será criada pelo DB Chaos Generator")
            else:
                logger.warning(f"   ❌ Erro: {result.get('status_code')}")
    
    def print_stats(self):
        """Imprime estatísticas"""
        logger.info("=" * 60)
        logger.info("📊 ESTATÍSTICAS")
        logger.info(f"   Total de transações: {self.stats['total']}")
        logger.info(f"   ✅ Sucesso: {self.stats['success']}")
        logger.info(f"   🚨 Erro R$ 100: {self.stats['error_100']}")
        logger.info(f"   🏛️ COAF: {self.stats['coaf']}")
        logger.info(f"   💸 Saldo insuficiente: {self.stats['insufficient']}")
        logger.info(f"   🔒 DB Lock (R$ 7777.77): {self.stats['db_lock']}")
        logger.info(f"   🐌 Slow Query (R$ 8888.88): {self.stats['slow_query']}")
        logger.info(f"   💀 Deadlock (R$ 9999.99): {self.stats['deadlock']}")
        logger.info(f"   ⏰ DB Wait (R$ 6666.66): {self.stats['db_wait']}")
        logger.info(f"   ❌ Outros erros: {self.stats['other_errors']}")
        logger.info("=" * 60)
    
    def run(self):
        """Loop principal do gerador de carga"""
        logger.info("=" * 60)
        logger.info("🐕 DogBank Load Generator - Iniciando...")
        logger.info(f"   Auth Service: {AUTH_SERVICE_URL}")
        logger.info(f"   Transaction Service: {TRANSACTION_SERVICE_URL}")
        logger.info(f"   Intervalo: {MIN_INTERVAL}s - {MAX_INTERVAL}s")
        logger.info("=" * 60)
        
        # Aguarda serviços ficarem prontos
        logger.info("⏳ Aguardando serviços ficarem prontos...")
        time.sleep(30)
        
        # Faz login em todas as contas
        logger.info("🔐 Fazendo login nas contas...")
        for account in ACCOUNTS:
            self.login(account)
        
        logger.info("🚀 Iniciando geração de transações...")
        
        transaction_count = 0
        while True:
            try:
                self.generate_transaction()
                transaction_count += 1
                
                # Imprime estatísticas a cada 10 transações
                if transaction_count % 10 == 0:
                    self.print_stats()
                
                # Intervalo aleatório entre transações
                interval = random.uniform(MIN_INTERVAL, MAX_INTERVAL)
                time.sleep(interval)
                
            except KeyboardInterrupt:
                logger.info("\n🛑 Parando gerador de carga...")
                self.print_stats()
                break
            except Exception as e:
                logger.error(f"❌ Erro inesperado: {e}")
                time.sleep(5)


if __name__ == "__main__":
    generator = LoadGenerator()
    generator.run()
