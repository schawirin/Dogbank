#!/bin/bash
# =============================================================================
# Ollama Entrypoint - Auto-pull model on startup
# =============================================================================

set -e

MODEL="${OLLAMA_MODEL:-llama3.2:1b}"

echo "🤖 Starting Ollama server..."

# Start Ollama in background
ollama serve &
OLLAMA_PID=$!

# Wait for Ollama to be ready
echo "⏳ Waiting for Ollama to be ready..."
until curl -s http://localhost:11434/api/tags > /dev/null 2>&1; do
    sleep 1
done
echo "✅ Ollama is ready!"

# Check if model exists
if ! ollama list | grep -q "$MODEL"; then
    echo "📥 Pulling model: $MODEL (this may take a few minutes on first run)..."
    ollama pull "$MODEL"
    echo "✅ Model $MODEL is ready!"
else
    echo "✅ Model $MODEL already exists"
fi

# List available models
echo "📊 Available models:"
ollama list

# Keep Ollama running in foreground
wait $OLLAMA_PID
