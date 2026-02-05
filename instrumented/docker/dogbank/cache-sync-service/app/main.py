"""
Cache Sync Service
==================
Kafka Consumer que mantém Redis sincronizado com eventos do banco
Consome: banking.accounts, banking.transactions
Atualiza: Redis (saldo, transações)
"""

import os
import json
import logging
import time
import redis
from datetime import datetime
from confluent_kafka import Consumer, KafkaError, KafkaException

# Datadog APM
from ddtrace import tracer, patch_all
patch_all()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration from environment
KAFKA_BOOTSTRAP_SERVERS = os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'kafka:9092')
KAFKA_GROUP_ID = os.getenv('KAFKA_GROUP_ID', 'cache-sync-service')
REDIS_HOST = os.getenv('REDIS_HOST', 'redis')
REDIS_PORT = int(os.getenv('REDIS_PORT', '6379'))
REDIS_DB = int(os.getenv('REDIS_DB', '0'))

# Redis configuration
REDIS_TRANSACTION_LIMIT = int(os.getenv('REDIS_TRANSACTION_LIMIT', '50'))

class CacheSyncService:
    """
    Kafka Consumer que sincroniza eventos com Redis
    """

    def __init__(self):
        self.redis_client = None
        self.consumer = None
        self._connect_redis()
        self._connect_kafka()

    def _connect_redis(self):
        """Connect to Redis"""
        try:
            self.redis_client = redis.Redis(
                host=REDIS_HOST,
                port=REDIS_PORT,
                db=REDIS_DB,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
            )
            self.redis_client.ping()
            logger.info(f"✅ Connected to Redis at {REDIS_HOST}:{REDIS_PORT}")
        except Exception as e:
            logger.error(f"❌ Failed to connect to Redis: {e}")
            raise

    def _connect_kafka(self):
        """Connect to Kafka as consumer using confluent-kafka for DSM support"""
        try:
            conf = {
                'bootstrap.servers': KAFKA_BOOTSTRAP_SERVERS,
                'group.id': KAFKA_GROUP_ID,
                'auto.offset.reset': 'earliest',
                'enable.auto.commit': False,
                'session.timeout.ms': 30000,
                'heartbeat.interval.ms': 10000,
                'max.poll.interval.ms': 300000,
            }

            self.consumer = Consumer(conf)
            self.consumer.subscribe(['banking.accounts', 'banking.transactions'])

            logger.info(f"✅ Connected to Kafka with confluent-kafka: {KAFKA_BOOTSTRAP_SERVERS}")
            logger.info(f"📋 Subscribed to topics: banking.accounts, banking.transactions")
            logger.info(f"🔍 DSM-enabled consumer ready (confluent-kafka)")
        except Exception as e:
            logger.error(f"❌ Failed to connect to Kafka: {e}")
            raise

    @tracer.wrap(service='cache-sync-service', resource='process_balance_updated')
    def _process_balance_updated(self, event: dict):
        """
        Process balance.updated event

        Updates Redis key: account:{account_id}:balance
        """
        try:
            account_id = event['account_id']
            new_balance = event['new_balance']

            # Update balance in Redis
            cache_key = f"account:{account_id}:balance"
            self.redis_client.set(cache_key, new_balance)

            logger.info(
                f"📦 Updated Redis: {cache_key} = {new_balance} "
                f"(delta={event.get('delta')}, reason={event.get('reason')})"
            )

        except Exception as e:
            logger.error(f"❌ Error processing balance.updated: {e}", exc_info=True)
            raise

    @tracer.wrap(service='cache-sync-service', resource='process_pix_completed')
    def _process_pix_completed(self, event: dict):
        """
        Process pix.completed event

        Updates Redis sorted set: account:{account_id}:transactions
        Keeps last N transactions (configured by REDIS_TRANSACTION_LIMIT)
        """
        try:
            origin_id = event['account_origin_id']
            dest_id = event['account_dest_id']
            amount = event['amount']
            txn_id = event['transaction_id']
            timestamp = event.get('timestamp', datetime.utcnow().isoformat())

            # Parse timestamp to unix timestamp for score
            try:
                dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                score = int(dt.timestamp())
            except:
                score = int(time.time())

            # Add transaction to origin account (outgoing)
            txn_out = {
                "id": txn_id,
                "type": "PIX_OUT",
                "amount": -amount,
                "to": event.get('pix_key_dest', 'unknown'),
                "timestamp": timestamp,
                "status": "completed"
            }

            origin_key = f"account:{origin_id}:transactions"
            self.redis_client.zadd(origin_key, {json.dumps(txn_out): score})

            # Keep only last N transactions
            self.redis_client.zremrangebyrank(origin_key, 0, -(REDIS_TRANSACTION_LIMIT + 1))

            logger.info(f"📦 Added PIX_OUT transaction to {origin_key} (score={score})")

            # Add transaction to destination account (incoming)
            txn_in = {
                "id": txn_id,
                "type": "PIX_IN",
                "amount": amount,
                "from": str(origin_id),
                "timestamp": timestamp,
                "status": "completed"
            }

            dest_key = f"account:{dest_id}:transactions"
            self.redis_client.zadd(dest_key, {json.dumps(txn_in): score})
            self.redis_client.zremrangebyrank(dest_key, 0, -(REDIS_TRANSACTION_LIMIT + 1))

            logger.info(f"📦 Added PIX_IN transaction to {dest_key} (score={score})")

        except Exception as e:
            logger.error(f"❌ Error processing pix.completed: {e}", exc_info=True)
            raise

    @tracer.wrap(service='cache-sync-service', resource='process_pix_failed')
    def _process_pix_failed(self, event: dict):
        """
        Process pix.failed event

        Currently just logs, but could update metrics/counters
        """
        try:
            txn_id = event['transaction_id']
            reason = event.get('reason', 'unknown')
            error_code = event.get('error_code', 'UNKNOWN')

            logger.warning(
                f"⚠️ PIX failed: txn_id={txn_id}, reason={reason}, error_code={error_code}"
            )

            # Could increment Redis counter for monitoring
            # self.redis_client.incr(f"metrics:pix:failed:{error_code}")

        except Exception as e:
            logger.error(f"❌ Error processing pix.failed: {e}", exc_info=True)

    def process_event(self, message):
        """
        Process a single Kafka message from confluent-kafka
        Routes to appropriate handler based on event_type
        """
        if message.error():
            if message.error().code() == KafkaError._PARTITION_EOF:
                logger.debug(f"Reached end of partition {message.partition()}")
            else:
                logger.error(f"❌ Kafka error: {message.error()}")
            return

        # Parse JSON value
        try:
            event = json.loads(message.value().decode('utf-8'))
        except Exception as e:
            logger.error(f"❌ Failed to parse message: {e}")
            return

        event_type = event.get('event_type')

        logger.info(
            f"📨 Received event: {event_type} from topic={message.topic()} "
            f"partition={message.partition()} offset={message.offset()}"
        )

        if event_type == 'balance.updated':
            self._process_balance_updated(event)
        elif event_type == 'pix.completed':
            self._process_pix_completed(event)
        elif event_type == 'pix.failed':
            self._process_pix_failed(event)
        else:
            logger.warning(f"⚠️ Unknown event type: {event_type}")

    def run(self):
        """
        Main consumer loop using confluent-kafka poll
        Continuously polls Kafka and processes events
        """
        logger.info("🚀 Starting Cache Sync Service with confluent-kafka (DSM-enabled)...")
        logger.info(f"📡 Kafka: {KAFKA_BOOTSTRAP_SERVERS}")
        logger.info(f"📦 Redis: {REDIS_HOST}:{REDIS_PORT}")
        logger.info(f"👥 Consumer Group: {KAFKA_GROUP_ID}")

        try:
            while True:
                # Poll for messages (timeout in seconds)
                message = self.consumer.poll(timeout=1.0)

                if message is None:
                    continue

                try:
                    # Process event
                    self.process_event(message)

                    # Manual commit after successful processing
                    self.consumer.commit(message)

                except Exception as e:
                    logger.error(f"❌ Error processing message: {e}", exc_info=True)
                    # Continue processing next messages
                    # In production, might want to send to DLQ

        except KeyboardInterrupt:
            logger.info("⚠️ Shutting down gracefully...")
        except Exception as e:
            logger.error(f"❌ Fatal error in consumer loop: {e}", exc_info=True)
            raise
        finally:
            self.consumer.close()
            logger.info("✅ Consumer closed")

if __name__ == "__main__":
    service = CacheSyncService()
    service.run()
