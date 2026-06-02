# DogBank Load Generator

Modo recomendado para a demo mobile/RUM:

```bash
cd instrumented/docker/dogbank
podman-compose -f docker-compose.full.yml -f docker-compose.mobile.yml -f docker-compose.load.yml up -d --build transaction-service load-generator
```

Por padrao, o `docker-compose.load.yml` dispara um burst inicial de PIX para popular o Datadog rapido e depois segue em loop:

- `DOGBANK_LOAD_BURST_COUNT=50`
- `DOGBANK_LOAD_BURST_INTERVAL=0.35`
- `DOGBANK_LOAD_MIN_INTERVAL=2`
- `DOGBANK_LOAD_MAX_INTERVAL=6`
- `DOGBANK_LOAD_RUN_ID=local-demo`

O modo `pix_cron` roda em loop os cenarios do README:

- `success`: PIX aprovado
- `invalid_pix_key`: chave PIX inexistente
- `insufficient_balance`: Renato tenta transferir R$ 10.000
- `self_transfer`: usuario tenta enviar PIX para a propria chave
- `bc_timeout`: valor R$ 100,00 gera timeout do Banco Central
- `limit_exceeded`: valor R$ 1.000,00 gera limite excedido

Para uma execucao curta de teste:

```bash
DOGBANK_LOAD_MIN_INTERVAL=1 DOGBANK_LOAD_MAX_INTERVAL=2 DOGBANK_LOAD_MAX_TRANSACTIONS=6 \
podman-compose -f docker-compose.full.yml -f docker-compose.mobile.yml -f docker-compose.load.yml up --build load-generator
```

Para uma demo mais agressiva:

```bash
DOGBANK_LOAD_RUN_ID=demo-cliente \
DOGBANK_LOAD_BURST_COUNT=100 \
DOGBANK_LOAD_BURST_INTERVAL=0.20 \
DOGBANK_LOAD_MIN_INTERVAL=1 \
DOGBANK_LOAD_MAX_INTERVAL=3 \
podman-compose -f docker-compose.full.yml -f docker-compose.mobile.yml -f docker-compose.load.yml up -d --build load-generator
```

Se o stack ja estiver de pe e voce quiser trocar apenas o gerador, prefira:

```bash
podman-compose -f docker-compose.full.yml -f docker-compose.mobile.yml -f docker-compose.load.yml up -d --no-deps --build load-generator
```

Se algum backend for recriado durante a demo, reinicie o gateway para renovar os upstreams:

```bash
podman restart dogbank-nginx
```

Logs:

```bash
podman logs -f dogbank-load-generator
```

Filtros uteis no Datadog:

```text
"dogbank.pix_cron.result"
@run_id:local-demo
@scenario:success
@scenario:invalid_pix_key
```
