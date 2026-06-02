#!/bin/bash
# =============================================================================
# Create Kafka Topics for Event-Driven Architecture
# =============================================================================

set -e

KAFKA_POD=$(kubectl get pods -n dogbank -l app=kafka -o jsonpath='{.items[0].metadata.name}')

if [ -z "$KAFKA_POD" ]; then
    echo "❌ Kafka pod not found"
    exit 1
fi

echo "✅ Found Kafka pod: $KAFKA_POD"
echo ""

# Topic 1: banking.accounts
echo "📋 Creating topic: banking.accounts"
kubectl exec -n dogbank $KAFKA_POD -- /opt/kafka/bin/kafka-topics.sh \
    --create \
    --if-not-exists \
    --bootstrap-server localhost:9092 \
    --topic banking.accounts \
    --partitions 3 \
    --replication-factor 1 \
    --config retention.ms=604800000 \
    --config compression.type=snappy \
    --config cleanup.policy=delete

# Topic 2: banking.transactions
echo "📋 Creating topic: banking.transactions"
kubectl exec -n dogbank $KAFKA_POD -- /opt/kafka/bin/kafka-topics.sh \
    --create \
    --if-not-exists \
    --bootstrap-server localhost:9092 \
    --topic banking.transactions \
    --partitions 3 \
    --replication-factor 1 \
    --config retention.ms=604800000 \
    --config compression.type=snappy \
    --config cleanup.policy=delete

echo ""
echo "✅ Topics created successfully"
echo ""

# List all topics
echo "📋 Current topics:"
kubectl exec -n dogbank $KAFKA_POD -- /opt/kafka/bin/kafka-topics.sh \
    --list \
    --bootstrap-server localhost:9092

echo ""

# Describe topics
echo "📊 Topic details:"
kubectl exec -n dogbank $KAFKA_POD -- /opt/kafka/bin/kafka-topics.sh \
    --describe \
    --bootstrap-server localhost:9092 \
    --topic banking.accounts

echo ""

kubectl exec -n dogbank $KAFKA_POD -- /opt/kafka/bin/kafka-topics.sh \
    --describe \
    --bootstrap-server localhost:9092 \
    --topic banking.transactions

echo ""
echo "🎉 Kafka topics setup complete!"
