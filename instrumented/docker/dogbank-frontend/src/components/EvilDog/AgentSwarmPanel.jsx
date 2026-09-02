import React, { useEffect, useRef, useState } from 'react';
import {
  Boxes, Clock, Hourglass, Activity, CheckCircle2, XCircle, Radio, X, RotateCw,
} from 'lucide-react';
import { levelClass, EvilBot, SwarmSizeStepper } from './parts';
import { useT } from '../../i18n';

// Same 8 pipeline stage ids as the main attack canvas (RECON..REPORT), driven
// here per real pod via `pod_node` events instead of the single-target
// `node` events used by AttackOrchestrator's canvas.
const PIPELINE_NODES = ['RECON', 'SCAN', 'DETECT', 'PAYLOAD', 'INJECT', 'ATO', 'TRANSFER', 'REPORT'];

// kubectl-style pod phase -> badge color. Running is intentionally amber
// (not red) so it doesn't visually compete with the red "attack in
// progress" signal already carried by the 8-stage dot row below it.
const PHASE_CLS = {
  Pending: 'text-slate-400 border-slate-600/50 bg-slate-700/20',
  ContainerCreating: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10',
  Running: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
  Succeeded: 'text-green-400 border-green-500/40 bg-green-500/10',
  Failed: 'text-red-400 border-red-500/40 bg-red-500/10',
  Terminating: 'text-slate-400 border-slate-600/50 bg-slate-700/20',
};

// Outcome (independent signal from phase) -> card border color.
const OUTCOME_BORDER = {
  blocked: 'border-red-500/50',
  contained: 'border-red-500/50',
  error: 'border-red-500/50',
  done: 'border-green-500/40',
};

const ATTACK_FAILURE_OUTCOMES = new Set(['blocked', 'contained', 'error']);

// A fase do container diz se o processo terminou; o outcome diz se o ataque
// venceu. Um container pode sair com sucesso depois de ser contido, portanto a
// UI precisa priorizar o desfecho de segurança para não exibir um falso SUCCEEDED.
export function agentAttackFailed(agent) {
  const stop = stopPoint(agent);
  return agent?.phase === 'Failed'
    || ATTACK_FAILURE_OUTCOMES.has(agent?.outcome)
    || stop.state === 'fail'
    || stop.state === 'contained';
}

export function agentDisplayPhase(agent) {
  return agentAttackFailed(agent) ? 'Failed' : (agent?.phase || 'Pending');
}

function PhaseBadge({ phase, label }) {
  return (
    <span className={`shrink-0 px-2 py-0.5 rounded-md border text-[9px] font-bold tracking-wider uppercase ${PHASE_CLS[phase] || PHASE_CLS.Pending}`}>
      {label || phase}
    </span>
  );
}

function ageSeconds(createdAt, until) {
  return Math.max(0, Math.floor(((until || Date.now()) - (createdAt || Date.now())) / 1000));
}

// Enquanto o pod vive o contador anda; quando ele é recolhido o tempo CONGELA em
// finishedAt, virando a duração final do agente no relatório.
function useAge(createdAt, finishedAt) {
  const [age, setAge] = useState(() => ageSeconds(createdAt, finishedAt));
  useEffect(() => {
    setAge(ageSeconds(createdAt, finishedAt));
    if (finishedAt) return undefined;
    const id = setInterval(() => setAge(ageSeconds(createdAt)), 1000);
    return () => clearInterval(id);
  }, [createdAt, finishedAt]);
  return age;
}

// Último estágio que o agente realmente alcançou + se ele morreu ali. É o "onde travou"
// do relatório: sem isso um pod recolhido não dizia nada sobre o próprio desfecho.
function stopPoint(agent) {
  const nodes = agent.nodes || {};
  let last = null;
  PIPELINE_NODES.forEach((n) => { if (nodes[n]) last = n; });
  if (!last) return { node: null, state: null, reachedIdx: -1 };
  return { node: last, state: nodes[last], reachedIdx: PIPELINE_NODES.indexOf(last) };
}

function PodCard({ agent, spawnDelayMs }) {
  const { t } = useT();
  const age = useAge(agent.createdAt, agent.finishedAt);
  const spawnCls = 'evd-pod-spawn';
  const stop = stopPoint(agent);
  const failed = agentAttackFailed(agent);
  const displayPhase = agentDisplayPhase(agent);
  const border = failed ? 'border-red-500/40' : (OUTCOME_BORDER[agent.outcome] || 'border-[#26313f]');
  const outcomeCls = failed ? 'text-red-400'
      : agent.outcome === 'done' ? 'text-green-400' : '';
  const outcomeTxt = failed ? t('evd.agent_attack_failed')
      : agent.outcome === 'done' ? t('evd.esc_ok') : '';

  return (
    <div
      data-testid="swarm-agent-card"
      data-attack-status={failed ? 'failed' : 'ok'}
      className={`rounded-lg border ${border} bg-[#0f151d] p-3 ${spawnCls} ${failed ? 'evd-agent-failed' : ''}`}
      style={{ animationDelay: `${spawnDelayMs}ms` }}
    >
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <EvilBot size={16} className={`text-red-400 shrink-0 ${failed ? 'evd-agent-failed-icon' : ''}`} />
          <span className="font-mono text-[11px] text-slate-300 truncate">{agent.name}</span>
        </div>
        <PhaseBadge phase={displayPhase} label={failed ? 'FAIL' : displayPhase} />
      </div>
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[11px] text-red-300/90 truncate">{agent.ip || '—'}</span>
        <span className="flex items-center gap-1 text-[10px] text-slate-500 tabular-nums shrink-0">
          <Clock className="w-3 h-3" /> {age}s
        </span>
      </div>
      <div className="space-y-1">
        {PIPELINE_NODES.map((n) => {
          const st = agent.nodes?.[n];
          const dot = st === 'success' ? 'bg-green-500'
            : st === 'fail' ? 'bg-red-500'
              : st === 'contained' ? 'bg-red-500 animate-pulse'
                : st === 'active' ? 'bg-amber-400 animate-pulse' : 'bg-slate-700';
          return (
            <div key={n} className="flex items-center gap-2 text-[11px]">
              <span className={`w-2 h-2 rounded-full ${dot}`} />
              <span className={st === 'success' ? 'text-slate-300' : (st === 'fail' || st === 'contained') ? 'text-red-400 font-bold' : 'text-slate-500'}>{n}</span>
            </div>
          );
        })}
      </div>
      {(agent.outcome || agent.reaped) && (
        <div className="mt-2 pt-2 border-t border-[#1e2733] space-y-1">
          {agent.outcome && (
            <div className={`text-[11px] font-bold ${outcomeCls}`}>{outcomeTxt}</div>
          )}
          {/* Relatório do agente: até onde chegou na cadeia antes de morrer. */}
          {stop.node && (
            <div className="text-[10px] text-slate-500">
              {(stop.state === 'fail' || stop.state === 'contained') ? t('evd.pod_stopped_at') : t('evd.pod_reached')}{' '}
              <span className={(stop.state === 'fail' || stop.state === 'contained') ? 'text-red-400 font-bold' : 'text-slate-300 font-bold'}>
                {stop.node}
              </span>
              <span className="text-slate-600"> ({stop.reachedIdx + 1}/{PIPELINE_NODES.length})</span>
            </div>
          )}
          {agent.reaped && (
            <div className="text-[10px] text-slate-600 font-mono">
              {t('evd.pod_reaped')} · {age}s
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Relatório da rodada: fica na tela depois que os pods morrem (antes a lane sumia e o
// resultado do escalate ia com ela).
function SwarmReport({ agents }) {
  const { t } = useT();
  const values = Object.values(agents);
  if (!values.length) return null;
  const byOutcome = { done: 0, failed: 0, unknown: 0 };
  values.forEach((a) => {
    const bucket = agentAttackFailed(a) ? 'failed' : (a.outcome === 'done' ? 'done' : 'unknown');
    byOutcome[bucket] += 1;
  });
  const stops = values.map((a) => ({ name: a.name, ip: a.ip, ...stopPoint(a) }));
  const rows = [
    { k: 'done', label: t('evd.esc_ok'), cls: 'text-green-400' },
    { k: 'failed', label: t('evd.agent_attack_failed'), cls: 'text-red-400' },
    { k: 'unknown', label: t('evd.pod_no_outcome'), cls: 'text-slate-400' },
  ].filter((r) => byOutcome[r.k] > 0);

  return (
    <div className="mt-3 rounded-lg border border-[#26313f] bg-[#0b1017] p-3">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
        {t('evd.swarm_report_title')}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
        {rows.map((r) => (
          <span key={r.k} className={`text-[11px] font-bold ${r.cls}`}>
            {byOutcome[r.k]} × {r.label}
          </span>
        ))}
      </div>
      <div className="space-y-0.5">
        {stops.map((s) => (
          <div key={s.name} className="flex items-center gap-2 text-[10px] font-mono">
            <span className="text-slate-500 truncate max-w-[45%]">{s.name}</span>
            <span className="text-red-300/80">{s.ip || '—'}</span>
            <span className={(s.state === 'fail' || s.state === 'contained') ? 'text-red-400 font-bold' : 'text-slate-400'}>
              {s.node ? `${s.node} (${s.reachedIdx + 1}/${PIPELINE_NODES.length})` : t('evd.pod_no_stage')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SwarmStatTiles({ agents }) {
  const { t } = useT();
  const values = Object.values(agents);
  const failed = values.filter(agentAttackFailed).length;
  const healthy = values.filter((a) => !agentAttackFailed(a));
  const pending = healthy.filter((a) => a.phase === 'Pending' || a.phase === 'ContainerCreating').length;
  const running = healthy.filter((a) => a.phase === 'Running').length;
  const succeeded = healthy.filter((a) => a.phase === 'Succeeded').length;
  const tiles = [
    { label: t('evd.pod_stat_pending'), value: pending, icon: Hourglass, color: 'text-slate-300' },
    { label: t('evd.pod_stat_running'), value: running, icon: Activity, color: 'text-amber-400' },
    { label: t('evd.pod_stat_succeeded'), value: succeeded, icon: CheckCircle2, color: 'text-green-400' },
    { label: t('evd.pod_stat_failed'), value: failed, icon: XCircle, color: 'text-red-400', alert: failed > 0 },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
      {tiles.map((tl) => {
        const Icon = tl.icon;
        return (
          <div key={tl.label} className={`rounded-lg border bg-[#0b1017] p-3 ${tl.alert ? 'border-red-500/35 evd-failed-stat' : 'border-[#1e2733]'}`}>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-wider">
              <Icon className={`w-3.5 h-3.5 ${tl.color}`} /> {tl.label}
            </div>
            <div className={`text-xl font-bold mt-1 tabular-nums ${tl.color}`}>{tl.value}</div>
          </div>
        );
      })}
    </div>
  );
}

function PodEventTicker({ feed, isK8s = true }) {
  const { t } = useT();
  const ref = useRef(null);
  const lines = (feed || []).filter((ev) => typeof ev.type === 'string' && ev.type.startsWith('pod_')).slice(-60);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [lines.length]);
  return (
    <div className="rounded-xl border border-[#1e2733] bg-[#080b10] overflow-hidden mb-3">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#1e2733]">
        <div className="flex items-center gap-2 text-slate-200 text-xs font-bold">
          <Radio className="w-3.5 h-3.5 text-green-400" /> {t('evd.pod_ticker_title')}
        </div>
        <span className="text-[10px] text-slate-600 font-mono">
          {isK8s ? 'kubectl get pods -n dogbank -w' : 'docker ps --filter name=evildog-agent'}
        </span>
      </div>
      <div ref={ref} className="evd-scroll p-3 overflow-y-auto text-[11px] leading-relaxed" style={{ height: '130px' }}>
        {lines.length === 0 && <div className="text-slate-600">{'// aguardando eventos do cluster…'}<span className="evd-blink">▊</span></div>}
        {lines.map((ev, i) => (
          <div key={i} className="evd-feed-enter">
            <span className="text-cyan-400">[{ev.ts}]</span>{' '}
            <span className={levelClass(ev.level)}>{ev.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AgentSwarmPanel({
  agents, swarmMeta, feed, escalateError, onRerun, onDismiss,
}) {
  const { t } = useT();
  const [rerunSize, setRerunSize] = useState(3);
  useEffect(() => {
    const requested = Number(swarmMeta?.requested);
    if ([3, 5, 8].includes(requested)) setRerunSize(requested);
  }, [swarmMeta?.requested]);
  const safeAgents = agents || {};
  const entries = Object.entries(safeAgents).sort((a, b) => (a[1].createdAt || 0) - (b[1].createdAt || 0));
  if (!entries.length && !swarmMeta?.active) return null;
  const cols = entries.length > 6 ? 4 : entries.length > 3 ? 3 : Math.max(1, entries.length);
  const active = !!swarmMeta?.active;
  const isK8s = (swarmMeta?.backend || 'kubernetes') === 'kubernetes';
  const errText = !escalateError ? null
    : escalateError.kind === 'cooldown'
      ? `${t('evd.esc_err_cooldown')} ${Math.ceil(escalateError.retryAfter || 0)}s`
      : escalateError.kind === 'capacity' ? t('evd.esc_err_capacity')
        : escalateError.kind === 'forbidden' ? t('evd.esc_err_forbidden')
          : escalateError.kind === 'unavailable' ? t('evd.esc_err_unavailable')
            : escalateError.kind === 'timeout' ? 'Tempo limite do enxame atingido; confira o relatório dos agentes.'
            : `${t('evd.esc_err_generic')} ${escalateError.detail || ''}`;

  return (
    <div className="rounded-xl border border-red-500/30 bg-[#0a0e14] p-4 evd-feed-enter">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
          <Boxes className="w-4 h-4" /> {isK8s ? t('evd.swarm_title') : t('evd.swarm_title_docker')}
          {' · '}{entries.length}/{swarmMeta?.requested || 0} {isK8s ? t('evd.pods') : t('evd.agents')}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Rótulo honesto: no stack local os agentes são containers, não pods de EKS. */}
          <div className="flex items-center gap-1.5 rounded-lg border border-[#26313f] bg-[#0f151d] px-2.5 py-1.5 font-mono text-[11px]">
            <span className="text-cyan-400">{isK8s ? '⎈' : '▣'}</span>
            <span className="text-slate-300">
              {isK8s ? 'eks-sandbox-datadog · ns/dogbank' : 'docker · dogbank-network'}
            </span>
          </div>
          {/* Rodar outra rodada sem precisar esperar um novo bloqueio para o banner voltar. */}
          <SwarmSizeStepper value={rerunSize} onChange={setRerunSize} disabled={active} />
          <button
            onClick={() => onRerun?.(rerunSize)}
            disabled={active}
            title={t('evd.swarm_rerun')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-bold hover:bg-red-400 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCw className={`w-3.5 h-3.5 ${active ? 'animate-spin' : ''}`} /> {t('evd.swarm_rerun')} ({rerunSize})
          </button>
          <button
            onClick={onDismiss}
            title={t('evd.swarm_close')}
            className="p-1.5 rounded-lg border border-[#26313f] text-slate-400 hover:text-slate-100 hover:border-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {errText && (
        <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
          {errText}
        </div>
      )}

      <SwarmStatTiles agents={safeAgents} />
      <PodEventTicker feed={feed} isK8s={isK8s} />

      {entries.length > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
          {entries.map(([name, agent], i) => (
            <PodCard key={name} agent={agent} spawnDelayMs={i * 90} />
          ))}
        </div>
      )}

      {/* Só depois que a rodada fecha (swarm_done), para não competir com o ao-vivo. */}
      {!swarmMeta?.active && entries.length > 0 && <SwarmReport agents={safeAgents} />}
    </div>
  );
}
