import { useCallback, useEffect, useRef, useState } from 'react';
import evilDogService from '../../services/evilDogService';

const MAX_FEED = 300;
const REFRESH_DEBOUNCE_MS = 350;
const TERMINAL_PIPELINE_STATES = new Set(['done', 'blocked', 'error', 'contained']);
const DEFAULT_CARDS = {
  vulnerabilities_found: 0,
  exploits_executed: 0,
  systems_compromised: 0,
  active_sessions: 0,
};
const DEFAULT_LOOT = { records: [], secrets: [], pix_stolen: [], summary: {} };

const outcomeFrom = (event = {}) => {
  const raw = event.outcome || event.reason || event.classification || event.state;
  const kind = String(raw || '').toUpperCase();
  if (kind === 'AAP_BLOCKED' || event.state === 'blocked') return 'AAP_BLOCKED';
  if (kind === 'USER_BLOCKED' || kind === 'CONTAINED' || event.state === 'contained') return 'USER_BLOCKED';
  if (kind === 'RATE_LIMITED') return 'RATE_LIMITED';
  if (kind === 'BACKEND_ERROR' || event.state === 'error') return 'BACKEND_ERROR';
  return kind || null;
};

const errorFrom = (error, fallback) => {
  const body = error?.response?.data || {};
  const status = error?.response?.status;
  return {
    kind: outcomeFrom(body) || (status === 429 ? 'RATE_LIMITED' : 'BACKEND_ERROR'),
    message: body.detail || body.error || error?.message || fallback,
    status,
  };
};

/**
 * Central state for the EvilDog tab. The backend is shared by the lab, so the
 * client keeps an explicit run id and never lets old SSE events repaint a newer
 * demonstration run.
 */
export default function useEvilDog() {
  const [connected, setConnected] = useState(false);
  const [feed, setFeed] = useState([]);
  const [nodeStates, setNodeStates] = useState({});
  const [cards, setCards] = useState(DEFAULT_CARDS);
  const [target, setTarget] = useState(null);
  const [config, setConfig] = useState({ target: '', targets: [] });
  const [vectors, setVectors] = useState([]);
  const [loot, setLoot] = useState(DEFAULT_LOOT);
  const [running, setRunning] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [blocked, setBlocked] = useState(false);
  const [pipelineOutcome, setPipelineOutcome] = useState(null);
  const [operationError, setOperationError] = useState(null);
  const [currentRunId, setCurrentRunId] = useState(null);
  const [escalating, setEscalating] = useState(false);
  const [agents, setAgents] = useState({});
  const [swarmMeta, setSwarmMeta] = useState({ requested: 0, active: false });
  const [escalateError, setEscalateError] = useState(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [preparing, setPreparing] = useState(false);

  const esRef = useRef(null);
  const currentRunIdRef = useRef(null);
  const pipelineActiveRef = useRef(false);
  const refreshTimerRef = useRef(null);
  const pipelinePollTimerRef = useRef(null);
  const refreshNeedsRef = useRef({ stats: false, loot: false });
  const pendingEscalateRef = useRef(null);
  const initialHydrationDoneRef = useRef(false);

  const requireOperatorSession = useCallback((error) => {
    if (error?.response?.status !== 401) return false;
    const body = error.response?.data || {};
    setAuthError(body.detail || body.error || 'Abra uma sessão de operador para usar o EvilDog.');
    setAuthRequired(true);
    return true;
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      const data = await evilDogService.getStats();
      if (data?.cards) setCards(data.cards);
    } catch (error) { requireOperatorSession(error); }
  }, [requireOperatorSession]);

  const refreshLoot = useCallback(async () => {
    try { setLoot(await evilDogService.getLoot()); } catch (error) { requireOperatorSession(error); }
  }, [requireOperatorSession]);

  // A swarm emits many pod events. Coalescing these reads avoids turning each
  // successful node into two extra HTTP calls and UI renders.
  const scheduleRefresh = useCallback((needs = {}) => {
    refreshNeedsRef.current.stats ||= Boolean(needs.stats);
    refreshNeedsRef.current.loot ||= Boolean(needs.loot);
    if (refreshTimerRef.current) return;
    refreshTimerRef.current = window.setTimeout(() => {
      const pending = refreshNeedsRef.current;
      refreshNeedsRef.current = { stats: false, loot: false };
      refreshTimerRef.current = null;
      if (pending.stats) refreshStats();
      if (pending.loot) refreshLoot();
    }, REFRESH_DEBOUNCE_MS);
  }, [refreshLoot, refreshStats]);

  const refreshTarget = useCallback(async () => {
    const [targetResult, configResult] = await Promise.allSettled([
      evilDogService.getTarget(),
      evilDogService.getConfig(),
    ]);
    if (targetResult.status === 'rejected') requireOperatorSession(targetResult.reason);
    if (configResult.status === 'rejected') requireOperatorSession(configResult.reason);
    const t = targetResult.status === 'fulfilled' ? targetResult.value : null;
    const c = configResult.status === 'fulfilled' ? configResult.value : null;
    if (t) setTarget(t);
    if (c) setConfig(c);
  }, [requireOperatorSession]);

  const resetClientState = useCallback(() => {
    currentRunIdRef.current = null;
    pipelineActiveRef.current = false;
    if (pipelinePollTimerRef.current) window.clearTimeout(pipelinePollTimerRef.current);
    pipelinePollTimerRef.current = null;
    setFeed([]);
    setNodeStates({});
    setCards(DEFAULT_CARDS);
    setLoot(DEFAULT_LOOT);
    setRunning(null);
    setLastResult(null);
    setBlocked(false);
    setPipelineOutcome(null);
    setOperationError(null);
    setCurrentRunId(null);
    setEscalating(false);
    setAgents({});
    setSwarmMeta({ requested: 0, active: false });
    setEscalateError(null);
  }, []);

  // Clearing a take must preserve the attacker identity. IP rotation is a
  // separate, explicit demo action exposed by the "Rotacionar IP" control.
  const prepareNewTake = useCallback(async ({ rotate = false, silent = false } = {}) => {
    if (pipelineActiveRef.current) {
      if (!silent) setOperationError({
        kind: 'RUN_ALREADY_ACTIVE',
        message: 'Aguarde o pipeline e os agentes terminarem antes de preparar um novo take.',
      });
      return null;
    }
    setPreparing(true);
    try {
      const reset = await evilDogService.resetDemo();
      resetClientState();
      const rotation = rotate ? await evilDogService.rotateIp() : null;
      await Promise.all([refreshTarget(), refreshStats(), refreshLoot()]);
      if (reset?.remediation?.status === 'skipped') {
        setOperationError({
          kind: 'BACKEND_ERROR',
          message: 'O painel foi limpo, mas o backend não possui a credencial para desbloquear os usuários do take anterior.',
        });
      }
      return { reset, rotation };
    } catch (error) {
      if (!requireOperatorSession(error) && !silent) {
        setOperationError(errorFrom(error, 'Não foi possível preparar um novo take.'));
      }
      return null;
    } finally {
      setPreparing(false);
    }
  }, [refreshLoot, refreshStats, refreshTarget, requireOperatorSession, resetClientState]);

  const applyPipelineState = useCallback((state = {}, { hydrate = false } = {}) => {
    if (state.nodes && typeof state.nodes === 'object') setNodeStates(state.nodes);
    const runId = state.run_id || state.runId || null;
    const status = String(state.status || state.state || '').toLowerCase();
    const outcome = outcomeFrom(state);

    if (runId) {
      currentRunIdRef.current = runId;
      setCurrentRunId(runId);
    }
    if (status === 'running') {
      pipelineActiveRef.current = true;
      setRunning('pipeline');
      setBlocked(false);
      setPipelineOutcome(null);
    } else if (TERMINAL_PIPELINE_STATES.has(status)) {
      pipelineActiveRef.current = false;
      if (pipelinePollTimerRef.current) window.clearTimeout(pipelinePollTimerRef.current);
      pipelinePollTimerRef.current = null;
      setRunning((value) => (value === 'pipeline' ? null : value));
      const result = { kind: outcome || (status === 'blocked' ? 'AAP_BLOCKED' : status === 'error' ? 'BACKEND_ERROR' : null), status, message: state.message || state.detail };
      setPipelineOutcome(result);
      setBlocked(result.kind === 'AAP_BLOCKED');
    } else if (hydrate && !runId) {
      // Legacy servers returned nodes only. They are useful for painting the
      // canvas, but cannot safely claim that an old run is currently active.
      pipelineActiveRef.current = false;
    }
  }, []);

  const hydratePipeline = useCallback(async ({ prepareStale = false } = {}) => {
    try {
      const state = await evilDogService.getPipelineState();
      const status = String(state?.status || state?.state || '').toLowerCase();
      if (prepareStale && TERMINAL_PIPELINE_STATES.has(status)) {
        // Limpar um take antigo nunca pode trocar silenciosamente a identidade
        // do atacante. O apresentador pode bloquear o IP no Datadog, atualizar a
        // página e executar novamente: a nova tentativa precisa usar o MESMO IP
        // para comprovar o enforcement. Rotação é somente uma ação explícita.
        await prepareNewTake({ rotate: false, silent: false });
        return;
      }
      applyPipelineState(state, { hydrate: true });
    } catch (error) { requireOperatorSession(error); }
  }, [applyPipelineState, prepareNewTake, requireOperatorSession]);

  // EventSource can be interrupted by a proxy, browser sleep or a short network
  // flap. Poll the authoritative run state while a pipeline is active so the UI
  // never remains stuck on "RODANDO…" when the backend has already finished.
  const pollPipelineUntilTerminal = useCallback((runId) => {
    if (!runId) return undefined;
    let cancelled = false;
    let attempts = 0;
    const poll = async () => {
      if (cancelled || currentRunIdRef.current !== runId || !pipelineActiveRef.current) return;
      attempts += 1;
      try {
        const state = await evilDogService.getPipelineState();
        const stateRunId = state?.run_id || state?.runId;
        if (!stateRunId || stateRunId === runId) applyPipelineState(state);
      } catch (error) {
        requireOperatorSession(error);
      }
      if (!cancelled && pipelineActiveRef.current && currentRunIdRef.current === runId) {
        if (attempts >= 180) {
          pipelineActiveRef.current = false;
          setRunning(null);
          setOperationError({ kind: 'BACKEND_ERROR', message: 'O acompanhamento do pipeline expirou; consulte o estado antes de repetir.' });
          return;
        }
        pipelinePollTimerRef.current = window.setTimeout(poll, 500);
      }
    };
    pipelinePollTimerRef.current = window.setTimeout(poll, 250);
    return () => {
      cancelled = true;
      if (pipelinePollTimerRef.current) window.clearTimeout(pipelinePollTimerRef.current);
      pipelinePollTimerRef.current = null;
    };
  }, [applyPipelineState, requireOperatorSession]);

  useEffect(() => {
    if (running !== 'pipeline' || !currentRunId) return undefined;
    return pollPipelineUntilTerminal(currentRunId);
  }, [currentRunId, pollPipelineUntilTerminal, running]);

  const acceptsPipelineEvent = useCallback((event) => {
    if (event.run_id || event.runId) return (event.run_id || event.runId) === currentRunIdRef.current;
    // Old servers did not tag node events. Do not apply one while a named run
    // is active, otherwise a queued or another-tab run can repaint this canvas.
    return !pipelineActiveRef.current && !currentRunIdRef.current;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let v = [];
      try { v = await evilDogService.getVectors(); } catch (error) { requireOperatorSession(error); }
      if (!cancelled && v) setVectors(v);
      refreshTarget();
      refreshStats();
      refreshLoot();
      await hydratePipeline({ prepareStale: true });
      initialHydrationDoneRef.current = true;
    })();

    const es = new EventSource(evilDogService.streamUrl());
    esRef.current = es;
    es.onopen = () => {
      setConnected(true);
      if (initialHydrationDoneRef.current) hydratePipeline();
    };
    es.onerror = () => setConnected(false);
    es.onmessage = (e) => {
      let ev;
      try { ev = JSON.parse(e.data); } catch (_) { return; }
      // Replayed telemetry belongs to a previous browser/session. It is useful
      // to the transport for continuity, but showing it after a reset makes a
      // brand-new demo look as if it already ran (or already failed).
      if (ev.replay) return;
      setFeed((prev) => {
        const next = [...prev, ev];
        return next.length > MAX_FEED ? next.slice(next.length - MAX_FEED) : next;
      });

      const pipelineEvent = ev.type === 'node' || ev.type === 'pipeline';
      if (pipelineEvent && acceptsPipelineEvent(ev)) {
        if (ev.type === 'node' && ev.node) {
          setNodeStates((prev) => ({ ...prev, [ev.node]: ev.state }));
        }
        if (ev.type === 'pipeline') applyPipelineState(ev);
      }

      if (ev.type === 'swarm_start') {
        if (ev.state === 'error') {
          setEscalating(false);
          setSwarmMeta((meta) => ({ ...meta, active: false }));
          setEscalateError({ kind: 'unavailable', detail: ev.message });
        } else {
          setBlocked(false);
          setEscalating(true);
          setSwarmMeta({ requested: ev.requested, active: true, backend: ev.backend, runId: ev.run_id });
          setAgents({});
        }
      }
      if (ev.type === 'pod_created') {
        setAgents((prev) => ({
          ...prev,
          [ev.pod]: {
            name: ev.pod, ip: null, phase: ev.phase || 'Pending', nodes: {}, outcome: null,
            createdAt: Date.now(),
          },
        }));
      }
      if (ev.type === 'pod_phase') {
        setAgents((prev) => (prev[ev.pod]
          ? { ...prev, [ev.pod]: { ...prev[ev.pod], phase: ev.phase } } : prev));
      }
      if (ev.type === 'pod_node') {
        setAgents((prev) => {
          const agent = prev[ev.pod] || { name: ev.pod, nodes: {}, phase: 'Running', createdAt: Date.now() };
          return { ...prev, [ev.pod]: { ...agent, nodes: { ...agent.nodes, [ev.node]: ev.state }, ip: ev.ip || agent.ip } };
        });
      }
      if (ev.type === 'pod_outcome') {
        setAgents((prev) => (prev[ev.pod]
          ? { ...prev, [ev.pod]: { ...prev[ev.pod], outcome: outcomeFrom(ev) || ev.outcome } } : prev));
      }
      if (ev.type === 'pod_deleted') {
        setAgents((prev) => (prev[ev.pod]
          ? { ...prev, [ev.pod]: { ...prev[ev.pod], reaped: true, finishedAt: Date.now() } } : prev));
      }
      if (ev.type === 'swarm_done') {
        setEscalating(false);
        setSwarmMeta((meta) => ({ ...meta, active: false }));
        if (ev.state === 'error' || ev.state === 'timeout') {
          setEscalateError({ kind: ev.state === 'timeout' ? 'timeout' : 'error', detail: ev.message });
        }
      }
      if (ev.type === 'pipeline' || ev.type === 'pod_outcome' || ev.node === 'TRANSFER') {
        scheduleRefresh({ stats: true, loot: true });
      }
    };
    return () => {
      cancelled = true;
      es.close();
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
      if (pipelinePollTimerRef.current) window.clearTimeout(pipelinePollTimerRef.current);
      pipelinePollTimerRef.current = null;
    };
  }, [acceptsPipelineEvent, applyPipelineState, hydratePipeline, refreshLoot, refreshStats, refreshTarget, requireOperatorSession, scheduleRefresh]);

  const fireAttack = useCallback(async (vector) => {
    setRunning(vector);
    setOperationError(null);
    try {
      const result = await evilDogService.runAttack(vector);
      setLastResult(result);
      if (result?.cards) setCards(result.cards);
      if (result?.ok === false || result?.blocked) {
        setOperationError({ kind: outcomeFrom(result) || (result.blocked ? 'AAP_BLOCKED' : 'BACKEND_ERROR'), message: result.detail || result.error || 'Ataque não foi concluído.' });
      }
      return result;
    } catch (error) {
      setOperationError(errorFrom(error, 'Não foi possível executar o ataque.'));
      return null;
    } finally {
      setRunning(null);
      scheduleRefresh({ stats: true, loot: true });
    }
  }, [scheduleRefresh]);

  const runPipeline = useCallback(async () => {
    if (pipelineActiveRef.current) {
      setOperationError({ kind: 'RUN_ALREADY_ACTIVE', message: 'Já existe um pipeline em execução. Aguarde o desfecho.' });
      return null;
    }
    pipelineActiveRef.current = true;
    currentRunIdRef.current = null;
    setCurrentRunId(null);
    setRunning('pipeline');
    setOperationError(null);
    setNodeStates({});
    setBlocked(false);
    setPipelineOutcome(null);
    try {
      const result = await evilDogService.runPipeline();
      const runId = result?.run_id || result?.runId;
      if (!runId) throw new Error('O servidor não retornou o identificador da execução.');
      currentRunIdRef.current = runId;
      setCurrentRunId(runId);
      return result;
    } catch (error) {
      pipelineActiveRef.current = false;
      setRunning(null);
      setOperationError(errorFrom(error, 'Não foi possível iniciar o pipeline.'));
      return null;
    }
  }, []);

  const startEscalation = useCallback(async (count = 3, { promptOnAuthFailure = true } = {}) => {
    setBlocked(false);
    setEscalateError(null);
    try {
      const result = await evilDogService.escalate(count);
      setEscalating(true);
      setSwarmMeta((meta) => ({ ...meta, requested: result?.branches || count, active: true, backend: result?.backend, runId: result?.run_id }));
      return result;
    } catch (error) {
      const body = error?.response?.data || {};
      const status = error?.response?.status;
      if (status === 401) {
        setEscalating(false);
        if (promptOnAuthFailure) {
          pendingEscalateRef.current = count;
          setAuthError(body.detail || body.error || 'Informe o token do operador para escalar o enxame.');
          setAuthRequired(true);
        } else {
          setAuthError(body.detail || body.error || 'A sessão do operador não foi aceita.');
          setAuthRequired(true);
        }
        return null;
      }
      setEscalating(false);
      setSwarmMeta((meta) => ({ ...meta, active: false }));
      setEscalateError(
        body.error === 'cooldown' ? { kind: 'cooldown', retryAfter: body.retry_after_s }
          : body.error === 'capacity' ? { kind: 'capacity' }
            : status === 403 ? { kind: 'forbidden' }
              : status === 503 ? { kind: 'unavailable' }
                : { kind: 'error', detail: body.error || error?.message },
      );
      return null;
    }
  }, []);

  const escalate = useCallback(async (count = 3) => {
    if (escalating) return null;
    return startEscalation(count);
  }, [escalating, startEscalation]);

  const loginOperator = useCallback(async (token) => {
    if (!token?.trim()) {
      setAuthError('Informe o token do operador.');
      return false;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      await evilDogService.createSession(token.trim());
      setAuthRequired(false);
      refreshTarget();
      refreshStats();
      refreshLoot();
      await hydratePipeline({ prepareStale: true });
      const pendingCount = pendingEscalateRef.current;
      pendingEscalateRef.current = null;
      if (pendingCount) await startEscalation(pendingCount, { promptOnAuthFailure: false });
      return true;
    } catch (error) {
      const body = error?.response?.data || {};
      setAuthError(body.detail || body.error || 'Token do operador inválido ou sessão indisponível.');
      setAuthRequired(true);
      return false;
    } finally {
      setAuthLoading(false);
    }
  }, [hydratePipeline, refreshLoot, refreshStats, refreshTarget, startEscalation]);

  const dismissOperatorLogin = useCallback(() => {
    pendingEscalateRef.current = null;
    setAuthRequired(false);
    setAuthError(null);
  }, []);

  const dismissSwarm = useCallback(() => {
    setEscalating(false);
    setAgents({});
    setSwarmMeta({ requested: 0, active: false });
    setEscalateError(null);
  }, []);

  const runPostExploit = useCallback(async (action, body = {}) => {
    setRunning(`pe:${action}`);
    setOperationError(null);
    try {
      const result = await evilDogService.runPostExploit(action, body);
      if (result?.cards) setCards(result.cards);
      if (result?.ok === false || result?.blocked) {
        setOperationError({ kind: outcomeFrom(result) || (result.blocked ? 'AAP_BLOCKED' : 'BACKEND_ERROR'), message: result.detail || result.error || 'Ação não foi concluída.' });
      }
      return result;
    } catch (error) {
      setOperationError(errorFrom(error, 'Não foi possível executar a ação de pós-exploração.'));
      return null;
    } finally {
      setRunning(null);
      scheduleRefresh({ stats: true, loot: true });
    }
  }, [scheduleRefresh]);

  const changeTarget = useCallback(async (value) => {
    setOperationError(null);
    try {
      const result = await evilDogService.setTarget(value);
      await refreshTarget();
      return result;
    } catch (error) {
      const details = errorFrom(error, 'Falha ao definir o alvo.');
      setOperationError(details);
      return { ok: false, error: details.message };
    }
  }, [refreshTarget]);

  // Deliberately explicit: opening, reloading or switching back to the tab must
  // never change the attacker identity during the "same IP is blocked" beat.
  const rotateIp = useCallback(async () => {
    setOperationError(null);
    try {
      const result = await evilDogService.rotateIp();
      await refreshTarget();
      return result;
    } catch (error) {
      setOperationError(errorFrom(error, 'Não foi possível rotacionar o IP de origem.'));
      return null;
    }
  }, [refreshTarget]);

  return {
    connected, feed, nodeStates, cards, target, config, vectors, loot, running, lastResult,
    sourceIp: target?.source_ip, blocked, pipelineOutcome, operationError, currentRunId,
    escalating, agents, swarmMeta, escalateError, authRequired, authError, authLoading, preparing,
    fireAttack, runPipeline, runPostExploit, changeTarget, refreshStats, refreshLoot, rotateIp,
    escalate, dismissSwarm, loginOperator, dismissOperatorLogin, prepareNewTake,
    clearOperationError: () => setOperationError(null),
    clearOutcome: () => {
      setOperationError(null);
      setPipelineOutcome(null);
      setBlocked(false);
    },
  };
}
