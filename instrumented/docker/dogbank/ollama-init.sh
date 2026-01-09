#!/bin/bash
# =============================================================================
# Ollama Model Initialization Script
# =============================================================================
# This script pulls the required LLM model after Ollama starts
# Run this after docker-compose up if the model isn't already downloaded

set -e

OLLAMA_HOST="${OLLAMA_HOST:-localhost:11434}"
MODEL="${OLLAMA_MODEL:-llama3.2:1b}"

echo "🤖 Waiting for Ollama to be ready..."
until curl -s "http://${OLLAMA_HOST}/api/tags" > /dev/null 2>&1; do
    echo "   Ollama not ready yet, waiting..."
    sleep 2
done

echo "✅ Ollama is ready!"

echo "📥 Pulling model: ${MODEL}"
echo "   This may take a few minutes on first run..."

curl -X POST "http://${OLLAMA_HOST}/api/pull" \
    -H "Content-Type: application/json" \
    -d "{\"name\": \"${MODEL}\"}"

echo ""
echo "✅ Model ${MODEL} is ready!"
echo ""
echo "📊 Available models:"
curl -s "http://${OLLAMA_HOST}/api/tags" | jq -r '.models[].name' 2>/dev/null || \
    curl -s "http://${OLLAMA_HOST}/api/tags"

echo ""
echo "🧪 Test the model:"
echo "   curl http://${OLLAMA_HOST}/v1/chat/completions \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"model\": \"${MODEL}\", \"messages\": [{\"role\": \"user\", \"content\": \"Hello!\"}]}'"
