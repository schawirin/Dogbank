#!/usr/bin/env python3
"""
DogBank Database Chaos Generator - Para Demo do DBM
====================================================
Este script intercepta transações com valores específicos e injeta
problemas de banco de dados para demonstrar o Datadog DBM.

Triggers (valores específicos):
- R$ 7777.77 → Lock prolongado (10-30s)
- R$ 8888.88 → Slow query (full table scan)
- R$ 9999.99 → Deadlock intencional
- R$ 6666.66 → Query waiting (aguarda lock de outra transação)
"""

import psycopg2
import random
import time
import logging
import os
import threading
from contextlib import contextmanager

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Configuração do PostgreSQL
DB_CONFIG = {
    'host': os.getenv('POSTGRES_HOST', 'postgres'),
    'port': int(os.getenv('POSTGRES_PORT', '5432')),
    'database': os.getenv('POSTGRES_DB', 'dogbank'),
    'user': os.getenv('POSTGRES_USER', 'dogbank'),
    'password': os.getenv('POSTGRES_PASSWORD', 'dogbank123'),
    'connect_timeout': 10
}

# Valores que trigam problemas
TRIGGER_VALUES = {
    7777.77: 'lock',      # Cria lock prolongado
    8888.88: 'slow',      # Query lenta (full scan)
    9999.99: 'deadlock',  # Deadlock
    6666.66: 'wait'       # Query waiting
}


class DBChaosGenerator:
    """Gerador de problemas de banco de dados para demo do DBM"""

    def __init__(self):
        self.active_locks = []  # Threads com locks ativos
        self.stats = {
            'locks_created': 0,
            'slow_queries': 0,
            'deadlocks': 0,
            'waits_created': 0
        }

    @contextmanager
    def get_connection(self, autocommit=False):
        """Context manager para conexão com PostgreSQL"""
        conn = None
        try:
            conn = psycopg2.connect(**DB_CONFIG)
            if autocommit:
                conn.autocommit = True
            yield conn
        finally:
            if conn:
                conn.close()

    def create_blocking_query(self, duration_seconds=15):
        """Cria uma query bloqueante que trava outras queries"""
        logger.info(f"🔒 [DBM-LOCK] Iniciando transação bloqueante por {duration_seconds}s...")
        self.stats['locks_created'] += 1

        try:
            with self.get_connection() as conn:
                cur = conn.cursor()

                # BEGIN TRANSACTION e faz SELECT FOR UPDATE (cria lock)
                cur.execute("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;")

                # Lock em múltiplas linhas da tabela accounts
                cur.execute("""
                    SELECT id, balance, cpf
                    FROM accounts
                    WHERE balance > 5000
                    FOR UPDATE;
                """)

                logger.info(f"   🔒 Lock adquirido em {cur.rowcount} contas")
                logger.info(f"   ⏳ Mantendo lock por {duration_seconds}s...")

                # Mantém o lock sem fazer COMMIT
                time.sleep(duration_seconds)

                # Finalmente faz COMMIT
                conn.commit()
                logger.info(f"   ✅ Lock liberado após {duration_seconds}s")

        except Exception as e:
            logger.error(f"   ❌ Erro ao criar lock: {e}")

    def execute_slow_query(self):
        """Executa query lenta sem índices (full table scan)"""
        logger.info(f"🐌 [DBM-SLOW] Executando slow query (full table scan)...")
        self.stats['slow_queries'] += 1

        try:
            with self.get_connection() as conn:
                cur = conn.cursor()

                # Query sem índice que força full table scan
                # Busca por substring em campo de texto
                start_time = time.time()

                cur.execute("""
                    SELECT a.id, a.cpf, a.balance, u.name, u.email
                    FROM accounts a
                    JOIN users u ON CAST(a.user_id AS TEXT) LIKE '%' || CAST(u.id AS TEXT) || '%'
                    WHERE LOWER(u.email) LIKE '%dogbank%'
                      AND a.balance::text LIKE '%0%'
                      AND LENGTH(u.name) > 5
                    ORDER BY RANDOM()
                    LIMIT 100;
                """)

                rows = cur.fetchall()
                duration = time.time() - start_time

                logger.info(f"   🐌 Query completada em {duration:.2f}s ({len(rows)} rows)")
                logger.info(f"   📊 Full table scan executado")

        except Exception as e:
            logger.error(f"   ❌ Erro na slow query: {e}")

    def create_deadlock(self):
        """Cria deadlock intencional entre duas transações"""
        logger.info(f"💀 [DBM-DEADLOCK] Criando deadlock intencional...")
        self.stats['deadlocks'] += 1

        # Thread 1: Lock A -> Lock B
        def transaction_1():
            try:
                with self.get_connection() as conn:
                    cur = conn.cursor()

                    cur.execute("BEGIN;")
                    # Lock na conta 1
                    cur.execute("SELECT * FROM accounts WHERE id = 1 FOR UPDATE;")
                    logger.info("   🔴 TX1: Lock adquirido em conta 1")

                    time.sleep(2)

                    # Tenta lock na conta 2 (vai esperar TX2)
                    logger.info("   🔴 TX1: Tentando lock na conta 2...")
                    cur.execute("SELECT * FROM accounts WHERE id = 2 FOR UPDATE;")

                    conn.commit()
                    logger.info("   🔴 TX1: COMMIT")

            except psycopg2.extensions.TransactionRollbackError as e:
                logger.warning(f"   💀 TX1: DEADLOCK DETECTADO! {e}")
            except Exception as e:
                logger.error(f"   ❌ TX1: Erro: {e}")

        # Thread 2: Lock B -> Lock A
        def transaction_2():
            try:
                time.sleep(1)  # Garante que TX1 começa primeiro

                with self.get_connection() as conn:
                    cur = conn.cursor()

                    cur.execute("BEGIN;")
                    # Lock na conta 2
                    cur.execute("SELECT * FROM accounts WHERE id = 2 FOR UPDATE;")
                    logger.info("   🔵 TX2: Lock adquirido em conta 2")

                    time.sleep(2)

                    # Tenta lock na conta 1 (vai causar deadlock)
                    logger.info("   🔵 TX2: Tentando lock na conta 1...")
                    cur.execute("SELECT * FROM accounts WHERE id = 1 FOR UPDATE;")

                    conn.commit()
                    logger.info("   🔵 TX2: COMMIT")

            except psycopg2.extensions.TransactionRollbackError as e:
                logger.warning(f"   💀 TX2: DEADLOCK DETECTADO! {e}")
            except Exception as e:
                logger.error(f"   ❌ TX2: Erro: {e}")

        # Executa ambas transações em paralelo
        t1 = threading.Thread(target=transaction_1)
        t2 = threading.Thread(target=transaction_2)

        t1.start()
        t2.start()

        t1.join(timeout=30)
        t2.join(timeout=30)

        logger.info("   ✅ Deadlock scenario completed")

    def create_waiting_query(self):
        """Cria query que espera por lock"""
        logger.info(f"⏰ [DBM-WAIT] Criando query que vai esperar por lock...")
        self.stats['waits_created'] += 1

        # Primeiro cria um lock em background
        def hold_lock():
            try:
                with self.get_connection() as conn:
                    cur = conn.cursor()
                    cur.execute("BEGIN;")
                    cur.execute("SELECT * FROM accounts WHERE id = 3 FOR UPDATE;")
                    logger.info("   🔒 Background: Lock mantido na conta 3")
                    time.sleep(15)  # Mantém por 15 segundos
                    conn.commit()
                    logger.info("   🔒 Background: Lock liberado")
            except Exception as e:
                logger.error(f"   ❌ Background lock error: {e}")

        # Inicia thread que segura o lock
        lock_thread = threading.Thread(target=hold_lock)
        lock_thread.start()

        time.sleep(2)  # Garante que lock foi adquirido

        # Agora tenta acessar a mesma conta (vai esperar)
        try:
            with self.get_connection() as conn:
                cur = conn.cursor()

                logger.info("   ⏰ Query tentando acessar conta bloqueada...")
                start = time.time()

                # Vai esperar até o lock ser liberado
                cur.execute("SELECT * FROM accounts WHERE id = 3 FOR UPDATE;")

                wait_time = time.time() - start
                logger.info(f"   ✅ Query completada após esperar {wait_time:.2f}s")

        except Exception as e:
            logger.error(f"   ❌ Erro na waiting query: {e}")

        lock_thread.join(timeout=20)

    def trigger_chaos_by_value(self, amount: float):
        """Verifica se o valor da transação trigga algum problema"""
        # Arredonda para 2 casas decimais
        amount = round(amount, 2)

        if amount in TRIGGER_VALUES:
            chaos_type = TRIGGER_VALUES[amount]
            logger.info(f"💥 TRIGGER DETECTADO! Valor R$ {amount:.2f} → {chaos_type.upper()}")

            if chaos_type == 'lock':
                # Lock de duração aleatória (10-30s)
                duration = random.randint(10, 30)
                threading.Thread(target=self.create_blocking_query, args=(duration,)).start()

            elif chaos_type == 'slow':
                threading.Thread(target=self.execute_slow_query).start()

            elif chaos_type == 'deadlock':
                threading.Thread(target=self.create_deadlock).start()

            elif chaos_type == 'wait':
                threading.Thread(target=self.create_waiting_query).start()

    def print_stats(self):
        """Imprime estatísticas"""
        logger.info("=" * 70)
        logger.info("📊 ESTATÍSTICAS DO DB CHAOS GENERATOR")
        logger.info("=" * 70)
        logger.info(f"   🔒 Locks criados: {self.stats['locks_created']}")
        logger.info(f"   🐌 Slow queries: {self.stats['slow_queries']}")
        logger.info(f"   💀 Deadlocks: {self.stats['deadlocks']}")
        logger.info(f"   ⏰ Waiting queries: {self.stats['waits_created']}")
        logger.info("=" * 70)

    def monitor_transactions(self):
        """Monitora transações PIX e trigga problemas"""
        logger.info("=" * 70)
        logger.info("🎯 DB Chaos Generator - Monitorando transações")
        logger.info("=" * 70)
        logger.info("Triggers configurados:")
        for value, chaos_type in TRIGGER_VALUES.items():
            logger.info(f"   R$ {value:.2f} → {chaos_type.upper()}")
        logger.info("=" * 70)

        # Aguarda PostgreSQL ficar pronto
        logger.info("⏳ Aguardando PostgreSQL...")
        time.sleep(45)

        try:
            with self.get_connection() as conn:
                cur = conn.cursor()
                cur.execute("SELECT version();")
                logger.info(f"✅ PostgreSQL conectado: {cur.fetchone()[0]}")
        except Exception as e:
            logger.error(f"❌ Erro ao conectar PostgreSQL: {e}")
            return

        logger.info("🚀 Iniciando monitoramento...")

        last_check = time.time()
        stat_counter = 0

        while True:
            try:
                # Verifica transações recentes (últimos 30 segundos)
                with self.get_connection() as conn:
                    cur = conn.cursor()

                    cur.execute("""
                        SELECT amount, created_at
                        FROM transactions
                        WHERE created_at > NOW() - INTERVAL '30 seconds'
                          AND amount IN (7777.77, 8888.88, 9999.99, 6666.66)
                        ORDER BY created_at DESC;
                    """)

                    transactions = cur.fetchall()

                    for amount, created_at in transactions:
                        # Verifica se já processamos esta transação
                        if (time.time() - created_at.timestamp()) < 25:
                            self.trigger_chaos_by_value(amount)

                stat_counter += 1
                if stat_counter >= 20:
                    self.print_stats()
                    stat_counter = 0

                time.sleep(5)  # Checa a cada 5 segundos

            except KeyboardInterrupt:
                logger.info("\n🛑 Parando DB Chaos Generator...")
                self.print_stats()
                break
            except Exception as e:
                logger.error(f"❌ Erro no monitor: {e}")
                time.sleep(10)


if __name__ == "__main__":
    generator = DBChaosGenerator()
    generator.monitor_transactions()
