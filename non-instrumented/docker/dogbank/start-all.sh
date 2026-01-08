#!/bin/sh
set -e

echo "Iniciando auth-module..."
java -jar auth-module.jar &

echo "Iniciando account-module..."
java -jar account-module.jar &

echo "Iniciando transaction-module..."
java -jar transaction-module.jar &

echo "Iniciando integration-module..."
java -jar integration-module.jar &

echo "Iniciando notification-module..."
java -jar notification-module.jar &

echo "Iniciando bancocentral-module..."
java -jar bancocentral-module.jar &

# Aguarda todos os processos terminarem (ou serem reiniciados)
wait
