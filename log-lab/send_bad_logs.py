#!/usr/bin/env python3
"""Sends raw PIX logs to Datadog (service:bad-logs) every execution."""

import json, requests, random, time, os
from datetime import datetime

API_KEY = os.environ.get("DD_API_KEY", "6d454652a9e849d7522b39219ef025e4")
URL = "https://http-intake.logs.datadoghq.com/api/v2/logs"
HEADERS = {"Content-Type": "application/json", "DD-API-KEY": API_KEY}

pdvs = ["pdv-loja-001", "pdv-loja-002", "pdv-loja-003", "pdv-loja-004", "pdv-loja-005"]
cpfs = ["123.456.789-00","987.654.321-00","111.222.333-44","555.666.777-88","999.888.777-66","444.333.222-11","666.555.444-33","777.888.999-00"]
emails = ["maria@email.com","loja@empresa.com.br","carlos@gmail.com","ana@hotmail.com"]
phones = ["+5511999887766","+5521988776655","+5531977665544","+5541966554433"]
bancos = ["Itau","Bradesco","Nubank","Inter","C6Bank","Caixa","BancoBrasil","Santander","Sicoob","BancoOriginal"]
ispbs = ["60701190","60746948","18236120","00416968","01181521","60872504","00000000","90400888","33172537","00000208"]
motivos_rejeicao = ["SALDO_INSUFICIENTE","CONTA_BLOQUEADA","LIMITE_DIARIO_EXCEDIDO","CHAVE_NAO_ENCONTRADA"]
nomes = ["JOAO SILVA","MARIA OLIVEIRA","CARLOS PEREIRA","ANA SOUZA","PEDRO SANTOS","LUCIA FERREIRA","MARCOS ALMEIDA","FERNANDA LIMA","ROBERTO COSTA","PATRICIA ROCHA"]

txid_counter = random.randint(1000, 9999)
nsu_base = random.randint(880000, 899999)

def now_str():
    return datetime.now().strftime("%d/%m/%Y %H:%M:%S")

def mk(pdv, msg):
    return {"message": msg, "ddsource": "pix-gateway", "service": "bad-logs", "hostname": pdv, "ddtags": "env:lab,team:dogbank"}

def gen_txid(pdv):
    global txid_counter
    txid_counter += 1
    return f"PIX{datetime.now().strftime('%Y%m%d%H%M%S')}{txid_counter:04d}{pdv[-3:]}"

def pix_ok(pdv):
    txid = gen_txid(pdv)
    cpf = random.choice(cpfs)
    banco = random.choice(bancos)
    ispb = random.choice(ispbs)
    nome = random.choice(nomes)
    valor = random.randint(500, 50000)
    vc = valor * 100
    global nsu_base; nsu_base += 1; nsu = nsu_base
    e2e = f"E{ispb}{txid_counter:020d}"
    t = now_str()
    return [
        mk(pdv, f"[{t}] [PDV={pdv[-3:]}][PIX] Iniciando transacao PIX valor={valor} chave=cpf:{cpf} txid={txid} nsu={nsu}"),
        mk(pdv, f"[{t}] [PDV={pdv[-3:]}][PIX][QRCODE] QR Code gerado com sucesso txid={txid} tipo={'DINAMICO' if valor > 2000 else 'ESTATICO'} valor_cents={vc} expiracao_seg={random.choice([300,600])}"),
        mk(pdv, f"[{t}] [PDV={pdv[-3:]}][PIX][DICT] Consulta DICT chave=cpf:{cpf} resultado=OK nome_beneficiario={nome} ispb={ispb} banco={banco}"),
        mk(pdv, f"[{t}] [PDV={pdv[-3:]}][PIX][PAGAMENTO] Confirmacao recebida txid={txid} endToEndId={e2e} valor_cents={vc} status=CONCLUIDA"),
        mk(pdv, f"[{t}] [PDV={pdv[-3:]}][VENDA][FINALIZADA] COO={random.randint(5500,6500)} valor_total_cents={vc} forma_pagamento=PIX nsu={nsu} cupom_fiscal=OK"),
    ]

def pix_timeout(pdv):
    txid = gen_txid(pdv)
    chave = f"email:{random.choice(emails)}"
    valor = random.randint(1000, 30000)
    vc = valor * 100
    global nsu_base; nsu_base += 1; nsu = nsu_base
    t = now_str()
    return [
        mk(pdv, f"[{t}] [PDV={pdv[-3:]}][PIX] Iniciando transacao PIX valor={valor} chave={chave} txid={txid} nsu={nsu}"),
        mk(pdv, f"[{t}] [PDV={pdv[-3:]}][PIX][QRCODE] QR Code gerado com sucesso txid={txid} tipo=DINAMICO valor_cents={vc} expiracao_seg=600"),
        mk(pdv, f"ERROR: [{t}] [PDV={pdv[-3:]}][PIX][TIMEOUT] Transacao PIX EXPIRADA txid={txid} tempo_espera_seg=600 status=TIMEOUT valor_cents={vc} chave={chave} msg=Cliente nao realizou o pagamento dentro do prazo"),
        mk(pdv, f"[{t}] [PDV={pdv[-3:]}][VENDA][CANCELADA] COO={random.randint(5500,6500)} motivo=PIX_TIMEOUT valor_cents={vc}"),
    ]

def pix_dict_fail(pdv):
    txid = gen_txid(pdv)
    chave = f"telefone:{random.choice(phones)}"
    valor = random.randint(500, 20000)
    vc = valor * 100
    global nsu_base; nsu_base += 1; nsu = nsu_base
    port = random.randint(40000, 60000)
    t = now_str()
    return [
        mk(pdv, f"[{t}] [PDV={pdv[-3:]}][PIX] Iniciando transacao PIX valor={valor} chave={chave} txid={txid} nsu={nsu}"),
        mk(pdv, f"ERROR: [{t}] [PDV={pdv[-3:]}][PIX][DICT] Falha na consulta DICT chave={chave} rc=-6 erro=TIMEOUT_COMUNICACAO msg=Nao foi possivel consultar o DICT do BACEN tempo_ms=3000 / Exception: java.net.SocketTimeoutException: failed to connect to /10.50.1.20 (port 8443) from /10.0.2.15 (port {port}) after 3000ms\tat libcore.io.IoBridge.connectErrno(IoBridge.java:235)\tat com.pix.gateway.DictClient.consultaChave(DictClient.java:112)\tat java.lang.Thread.run(Thread.java:1119)"),
        mk(pdv, f"ERROR: [{t}] [PDV={pdv[-3:]}][PIX][TRANSACAO] Transacao PIX REJEITADA txid={txid} motivo=DICT_INDISPONIVEL rc=-6 valor_cents={vc} tentativa=1/3"),
    ]

def pix_psp_down(pdv):
    txid = gen_txid(pdv)
    cpf = random.choice(cpfs)
    valor = random.randint(2000, 40000)
    vc = valor * 100
    global nsu_base; nsu_base += 1; nsu = nsu_base
    port = random.randint(50000, 60000)
    t = now_str()
    lines = [mk(pdv, f"[{t}] [PDV={pdv[-3:]}][PIX] Iniciando transacao PIX valor={valor} chave=cpf:{cpf} txid={txid} nsu={nsu}")]
    for attempt in range(1, 4):
        lines.append(mk(pdv, f"ERROR: [{t}] [PDV={pdv[-3:]}][PIX][PSP] Erro de comunicacao com PSP rc=-6 erro=CONNECTION_REFUSED endpoint=/10.50.1.20:8443/api/v2/pix msg=Servico do PSP indisponivel / Exception: java.net.ConnectException: failed to connect to /10.50.1.20 (port 8443) from /10.0.2.15 (port {port+attempt}) after 5000ms: isConnected failed: ECONNREFUSED (Connection refused)\tat libcore.io.IoBridge.isConnected(IoBridge.java:347)\tat com.pix.gateway.PspClient.enviaTransacao(PspClient.java:78)\tat java.lang.Thread.run(Thread.java:1119)"))
        status = "FALHOU" if attempt == 3 else "REJEITADA"
        extra = " status_final=FALHA_DEFINITIVA" if attempt == 3 else ""
        lines.append(mk(pdv, f"ERROR: [{t}] [PDV={pdv[-3:]}][PIX][TRANSACAO] Transacao PIX {status} txid={txid} motivo=PSP_INDISPONIVEL rc=-6 valor_cents={vc} tentativa={attempt}/3{extra}"))
    lines.append(mk(pdv, f"[{t}] [PDV={pdv[-3:]}][VENDA][CANCELADA] COO={random.randint(5500,6500)} motivo=PIX_FALHA_PSP valor_cents={vc}"))
    return lines

def pix_fraude(pdv):
    txid = gen_txid(pdv)
    valor = random.randint(5000, 80000)
    vc = valor * 100
    global nsu_base; nsu_base += 1
    cnpj = f"{random.randint(10,99)}.{random.randint(100,999)}.{random.randint(100,999)}/0001-{random.randint(10,99)}"
    t = now_str()
    return [
        mk(pdv, f"[{t}] [PDV={pdv[-3:]}][PIX] Iniciando transacao PIX valor={valor} chave=cnpj:{cnpj} txid={txid} nsu={nsu_base}"),
        mk(pdv, f"ERROR: [{t}] [PDV={pdv[-3:]}][PIX][ANTIFRAUDE] Transacao bloqueada por suspeita de fraude txid={txid} rc=-99 erro=FRAUDE_DETECTADA motivo=VELOCIDADE_TRANSACIONAL score_risco={random.randint(85,99)} msg=Multiplas transacoes de alto valor em curto periodo chave=cnpj:{cnpj} qtd_ultimas_1h={random.randint(8,25)} valor_acumulado_1h_cents={random.randint(20000000,80000000)}"),
        mk(pdv, f"ERROR: [{t}] [PDV={pdv[-3:]}][PIX][TRANSACAO] Transacao PIX BLOQUEADA txid={txid} motivo=ANTIFRAUDE rc=-99 valor_cents={vc}"),
    ]

def pix_devolucao_fail(pdv):
    txid = gen_txid(pdv)
    valor = random.randint(3000, 25000)
    vc = valor * 100
    e2e = f"E{random.choice(ispbs)}{txid_counter:020d}"
    dev_id = f"D{random.choice(ispbs)}{txid_counter:020d}"
    saldo = random.randint(10000, vc - 10000)
    t = now_str()
    return [
        mk(pdv, f"[{t}] [PDV={pdv[-3:]}][PIX][DEVOLUCAO] Solicitacao de devolucao PIX txid={txid} endToEndId={e2e} valor_devolucao_cents={vc} motivo=PRODUTO_DEFEITUOSO devolucaoId={dev_id}"),
        mk(pdv, f"ERROR: [{t}] [PDV={pdv[-3:]}][PIX][DEVOLUCAO] Falha na devolucao PIX txid={txid} devolucaoId={dev_id} rc=-12 erro=PSP_REJEITOU_DEVOLUCAO msg=O PSP do pagador rejeitou a devolucao: saldo insuficiente na conta transitoria / Exception: com.pix.exception.DevolucaoException: PSP_REJECTION saldo_transitoria_cents={saldo} valor_solicitado_cents={vc}\tat com.pix.service.DevolucaoService.processaDevolucao(DevolucaoService.java:156)\tat java.lang.Thread.run(Thread.java:1119)"),
    ]

def pix_conciliacao(pdv):
    total = random.randint(30, 80)
    div = random.randint(1, 5)
    ok = total - div
    vpix = random.randint(50000000, 150000000)
    diff = random.randint(1000, 50000)
    t = now_str()
    return [
        mk(pdv, f"[{t}] [PDV={pdv[-3:]}][PIX][CONCILIACAO] Inicio conciliacao PIX periodo=2026-03-06T08:00:00/2026-03-06T12:00:00 loja={pdv[-3:]}"),
        mk(pdv, f"ERROR: [{t}] [PDV={pdv[-3:]}][PIX][CONCILIACAO] Divergencia encontrada txid=PIX20260306{random.randint(100000,999999)}{pdv[-3:]} valor_pix_cents={random.randint(100000,500000)} valor_venda_cents={random.randint(100000,500000)} diferenca_cents={diff} tipo=VALOR_DIVERGENTE"),
        mk(pdv, f"[{t}] [PDV={pdv[-3:]}][PIX][CONCILIACAO] Resultado total_transacoes={total} conciliadas_ok={ok} divergencias={div} valor_total_pix_cents={vpix} valor_total_vendas_cents={vpix + diff}"),
    ]

def pix_health(pdv):
    pu = random.randint(60, 95)
    pa = random.randint(6, 10)
    pend = random.randint(5, 30)
    t = now_str()
    return [
        mk(pdv, f"[{t}] Analise de recursos PIX Gateway=== Conexoes PSP ===Pool Ativo: {pa}Pool Livre: {10-pa}Pool Maximo: 10Uso Pool (%): {pu}%=== Fila de Transacoes ===Pendentes: {pend}Processando: {random.randint(1,5)}Timeout: {random.randint(0,4)}=== Latencia ===Media DICT (ms): {random.randint(200,800)}P95 DICT (ms): {random.randint(800,2000)}Media PSP (ms): {random.randint(500,1500)}P95 PSP (ms): {random.randint(1500,4000)}=== Certificados ===mTLS PSP: Valido ate 2026-06-15mTLS BACEN: Valido ate 2026-09-20"),
    ]

def pix_rejeicao(pdv):
    txid = gen_txid(pdv)
    cpf = random.choice(cpfs)
    valor = random.randint(500, 15000)
    vc = valor * 100
    banco = random.choice(bancos)
    e2e = f"E{random.choice(ispbs)}{txid_counter:020d}"
    motivo = random.choice(motivos_rejeicao)
    global nsu_base; nsu_base += 1; nsu = nsu_base
    t = now_str()
    return [
        mk(pdv, f"[{t}] [PDV={pdv[-3:]}][PIX] Iniciando transacao PIX valor={valor} chave=cpf:{cpf} txid={txid} nsu={nsu}"),
        mk(pdv, f"ERROR: [{t}] [PDV={pdv[-3:]}][PIX][PAGAMENTO] Pagamento PIX REJEITADO pelo PSP txid={txid} endToEndId={e2e} rc=-22 erro={motivo} msg=Conta do pagador com restricao valor_cents={vc} banco_pagador={banco}"),
        mk(pdv, f"[{t}] [PDV={pdv[-3:]}][OPERADOR] Msg='PIX REJEITADO - {motivo}. Solicitar outra forma de pagamento.' | Opcoes=NOVA_FORMA,CANCELAR"),
    ]

def send_batch():
    all_logs = []
    # Mix de cenarios por execucao - volume alto
    for _ in range(random.randint(8, 15)):
        all_logs.extend(pix_ok(random.choice(pdvs)))
    for _ in range(random.randint(3, 5)):
        all_logs.extend(pix_timeout(random.choice(pdvs)))
    for _ in range(random.randint(3, 6)):
        all_logs.extend(pix_dict_fail(random.choice(pdvs)))
    for _ in range(random.randint(1, 3)):
        all_logs.extend(pix_psp_down(random.choice(pdvs)))
    for _ in range(random.randint(1, 2)):
        all_logs.extend(pix_fraude(random.choice(pdvs)))
    for _ in range(random.randint(1, 3)):
        all_logs.extend(pix_devolucao_fail(random.choice(pdvs)))
    if random.random() > 0.5:
        all_logs.extend(pix_conciliacao(random.choice(pdvs)))
    all_logs.extend(pix_health(random.choice(pdvs)))
    for _ in range(random.randint(3, 5)):
        all_logs.extend(pix_rejeicao(random.choice(pdvs)))

    total = 0
    for i in range(0, len(all_logs), 20):
        batch = all_logs[i:i+20]
        resp = requests.post(URL, headers=HEADERS, json=batch)
        if resp.status_code == 202:
            total += len(batch)
    print(f"[{datetime.now().isoformat()}] Enviados {total} logs para service:bad-logs")

if __name__ == "__main__":
    interval = int(os.environ.get("LOG_INTERVAL", "15"))
    while True:
        send_batch()
        time.sleep(interval)
