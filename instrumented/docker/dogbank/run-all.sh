#!/usr/bin/env bash
set -e

# 1) Força Java 17
export JAVA_HOME=$(/usr/libexec/java_home -v17)
export PATH="$JAVA_HOME/bin:$PATH"
echo "🟢 Java: $(java -version 2>&1 | head -n1)"

# 2) Caminho do dd-java-agent
DD_AGENT_JAR="$(pwd)/dd-java-agent.jar"
echo "🟢 Datadog Java Agent: ${DD_AGENT_JAR}"

# 3) Módulos e portas
modules=( auth-module account-module transaction-module integration-module notification-module bancocentral-module )
ports=( 8088        8089           8084                8082                8083                8085 )

# 4) Mata processos nas portas
for port in "${ports[@]}"; do
  if pid=$(lsof -t -i :"$port"); then
    echo "🛑 Matando $pid na porta $port"
    kill -9 "$pid"
  fi
done

# 5) Função para subir módulo com Agent
start_module(){
  module=$1; port=$2
  echo "🚀 Iniciando ${module} na porta ${port}…"
  (
    cd "$module"
    mvn spring-boot:run \
      -Dspring-boot.run.jvmArguments="\
-javaagent:${DD_AGENT_JAR} \
-Ddd.service=${module} \
-Ddd.env=development \
-Ddd.version=1.0 \
-Ddd.trace.analytics.enabled=true" \
      -Dspring-boot.run.arguments="--server.port=${port}"
  ) &
}

# 6) Inicia todos em background
for i in "${!modules[@]}"; do
  start_module "${modules[i]}" "${ports[i]}"
done

# 7) Aguarda todos (ou Ctrl+C para parar)
wait
