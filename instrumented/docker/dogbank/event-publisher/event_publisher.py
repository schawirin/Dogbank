"""
Event Publisher Library
=======================
Biblioteca compartilhada para publicação de eventos no Kafka
Usada por: transaction-service, account-service
"""

import os
import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from kafka import KafkaProducer
from kafka.errors import KafkaError

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Kafka configuration from environment
KAFKA_BOOTSTRAP_SERVERS = os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'kafka:9092')

class EventPublisher:
    """
    Event Publisher for Kafka
    Singleton pattern to reuse producer connection
    """
    _instance = None
    _producer = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(EventPublisher, cls).__new__(cls)
            cls._instance._initialize_producer()
        return cls._instance

    def _initialize_producer(self):
        """Initialize Kafka producer with configuration"""
        try:
            self._producer = KafkaProducer(
                bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS.split(','),
                value_serializer=lambda v: json.dumps(v).encode('utf-8'),
                key_serializer=lambda k: k.encode('utf-8') if k else None,
                acks='all',  # Wait for all replicas
                retries=3,
                max_in_flight_requests_per_connection=1,  # Guarantee ordering
                compression_type='snappy',
                linger_ms=10,  # Batch messages for 10ms
            )
            logger.info(f"✅ Kafka producer initialized: {KAFKA_BOOTSTRAP_SERVERS}")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Kafka producer: {e}")
            self._producer = None

    def _publish(self, topic: str, event: Dict[str, Any], key: Optional[str] = None) -> bool:
        """
        Internal method to publish event to Kafka

        Args:
            topic: Kafka topic name
            event: Event payload (dict)
            key: Partition key (optional)

        Returns:
            bool: True if published successfully, False otherwise
        """
        if not self._producer:
            logger.error("❌ Kafka producer not initialized")
            return False

        try:
            # Add timestamp if not present
            if 'timestamp' not in event:
                event['timestamp'] = datetime.utcnow().isoformat() + 'Z'

            # Publish to Kafka
            future = self._producer.send(topic, value=event, key=key)

            # Wait for acknowledgment (with timeout)
            record_metadata = future.get(timeout=10)

            logger.info(
                f"✅ Published {event.get('event_type')} to {topic} "
                f"(partition={record_metadata.partition}, offset={record_metadata.offset})"
            )
            return True

        except KafkaError as e:
            logger.error(f"❌ Kafka error publishing event: {e}")
            return False
        except Exception as e:
            logger.error(f"❌ Unexpected error publishing event: {e}")
            return False

    def publish_balance_updated(
        self,
        account_id: int,
        delta: float,
        new_balance: float,
        reason: str,
        transaction_id: Optional[str] = None
    ) -> bool:
        """
        Publish balance.updated event

        Args:
            account_id: Account ID that had balance updated
            delta: Change amount (positive or negative)
            new_balance: New balance after update
            reason: Reason for update (e.g., "pix_transfer_out", "deposit")
            transaction_id: Related transaction ID (optional)

        Returns:
            bool: Success status
        """
        event = {
            "event_type": "balance.updated",
            "account_id": account_id,
            "delta": round(delta, 2),
            "new_balance": round(new_balance, 2),
            "reason": reason,
            "transaction_id": transaction_id,
        }

        return self._publish(
            topic='banking.accounts',
            event=event,
            key=str(account_id)  # Partition by account_id
        )

    def publish_pix_completed(
        self,
        transaction_id: str,
        account_origin_id: int,
        account_dest_id: int,
        amount: float,
        balance_origin_after: float,
        balance_dest_after: float,
        pix_key_dest: str
    ) -> bool:
        """
        Publish pix.completed event

        Args:
            transaction_id: Unique transaction ID
            account_origin_id: Origin account ID
            account_dest_id: Destination account ID
            amount: Transfer amount
            balance_origin_after: Origin balance after transfer
            balance_dest_after: Destination balance after transfer
            pix_key_dest: Destination PIX key

        Returns:
            bool: Success status
        """
        event = {
            "event_type": "pix.completed",
            "transaction_id": transaction_id,
            "account_origin_id": account_origin_id,
            "account_dest_id": account_dest_id,
            "amount": round(amount, 2),
            "balance_origin_after": round(balance_origin_after, 2),
            "balance_dest_after": round(balance_dest_after, 2),
            "pix_key_dest": pix_key_dest,
        }

        return self._publish(
            topic='banking.transactions',
            event=event,
            key=transaction_id  # Partition by transaction_id
        )

    def publish_pix_failed(
        self,
        transaction_id: str,
        account_origin_id: int,
        reason: str,
        error_code: str
    ) -> bool:
        """
        Publish pix.failed event

        Args:
            transaction_id: Unique transaction ID
            account_origin_id: Origin account ID
            reason: Human-readable failure reason
            error_code: Error code for categorization

        Returns:
            bool: Success status
        """
        event = {
            "event_type": "pix.failed",
            "transaction_id": transaction_id,
            "account_origin_id": account_origin_id,
            "reason": reason,
            "error_code": error_code,
        }

        return self._publish(
            topic='banking.transactions',
            event=event,
            key=transaction_id
        )

    def flush(self):
        """Flush pending messages (use before shutdown)"""
        if self._producer:
            self._producer.flush()
            logger.info("✅ Kafka producer flushed")

    def close(self):
        """Close producer connection"""
        if self._producer:
            self._producer.close()
            logger.info("✅ Kafka producer closed")

# Singleton instance
_publisher = None

def get_publisher() -> EventPublisher:
    """Get singleton EventPublisher instance"""
    global _publisher
    if _publisher is None:
        _publisher = EventPublisher()
    return _publisher
