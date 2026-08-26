import React, { useEffect, useRef, useState } from 'react';
import {
  Boxes, Clock, Hourglass, Activity, CheckCircle2, XCircle, Radio,
} from 'lucide-react';
import { levelClass, EvilBot } from './parts';
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
  error: 'border-amber-500/50',
  done: 'border-green-500/40',
};

function PhaseBadge({ phase }) {
  return (
    <span className={`shrink-0 px-2 py-0.5 rounded-md border text-[9px] font-bold tracking-wider uppercase ${PHASE_CLS[phase] || PHASE_CLS.Pending}`}>
      {phase}
    </span>
  );
}

function ageSeconds(createdAt) {
  return Math.max(0, Math.floor((Date.now() - (createdAt || Date.now())) / 1000));
}

function useAge(createdAt) {
  const [age, setAge] = useState(() => ageSeconds(createdAt));
  useEffect(() => {
    setAge(ageSeconds(createdAt));
    const id = setInterval(() => setAge(ageSeconds(createdAt)), 1000);
    return () => clearInterval(id);
  }, [createdAt]);
  return age;
}

function PodCard({ agent, spawnDelayMs }) {
  const { t } = useT();
  const age = useAge(agent.createdAt);
  const spawnCls = agent.phase === 'Terminating' ? 'evd-pod-reap' : 'evd-pod-spawn';
  const border = OUTCOME_BORDER[agent.outcome] || 'border-[#26313f]';
  const outcomeCls = agent.outcome === 'blocked' ? 'text-red-400'
    : agent.outcome === 'error' ? 'text-amber-400'
      : agent.outcome === 'done' ? 'text-green-400' : '';
  const outcomeTxt = agent.outcome === 'blocked' ? t('evd.esc_blocked')
    : agent.outcome === 'error' ? t('evd.esc_contained')
      : agent.outcome === 'done' ? t('evd.esc_ok') : '';

  return (
    <div className={`rounded-lg border ${border} bg-[#0f151d] p-3 ${spawnCls}`} style={{ animationDelay: `${spawnDelayMs}ms` }}>
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <EvilBot size={16} className="text-red-400 shrink-0" />
          <span className="font-mono text-[11px] text-slate-300 truncate">{agent.name}</span>
        </div>
        <PhaseBadge phase={agent.phase} />
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
              : st === 'contained' ? 'bg-amber-400'
                : st === 'active' ? 'bg-amber-400 animate-pulse' : 'bg-slate-700';
          return (
            <div key={n} className="flex items-center gap-2 text-[11px]">
              <span className={`w-2 h-2 rounded-full ${dot}`} />
              <span className={st === 'success' ? 'text-slate-300' : st === 'fail' ? 'text-red-400' : st === 'contained' ? 'text-amber-400' : 'text-slate-500'}>{n}</span>
            </div>
          );
        })}
      </div>
      {agent.outcome && (
        <div className={`mt-2 pt-2 border-t border-[#1e2733] text-[11px] font-bold ${outcomeCls}`}>
          {outcomeTxt}
        </div>
      )}
    </div>
  );
}

function SwarmStatTiles({ agents }) {
  const { t } = useT();
  const values = Object.values(agents);
  const pending = values.filter((a) => a.phase === 'Pending' || a.phase === 'ContainerCreating').length;
  const running = values.filter((a) => a.phase === 'Running').length;
  const succeeded = values.filter((a) => a.phase === 'Succeeded').length;
  const failed = values.filter((a) => a.phase === 'Failed').length;
  const tiles = [
    { label: t('evd.pod_stat_pending'), value: pending, icon: Hourglass, color: 'text-slate-300' },
    { label: t('evd.pod_stat_running'), value: running, icon: Activity, color: 'text-amber-400' },
    { label: t('evd.pod_stat_succeeded'), value: succeeded, icon: CheckCircle2, color: 'text-green-400' },
    { label: t('evd.pod_stat_failed'), value: failed, icon: XCircle, color: 'text-red-400' },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
      {tiles.map((tl) => {
        const Icon = tl.icon;
        return (
          <div key={tl.label} className="rounded-lg border border-[#1e2733] bg-[#0b1017] p-3">
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

function PodEventTicker({ feed }) {
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
        <span className="text-[10px] text-slate-600 font-mono">kubectl get pods -n dogbank -w</span>
      </div>
      <div ref={ref} className="evd-scroll p-3 overflow-y-auto text-[11px] leading-relaxed" style={{ height: '130px' }}>
        {lines.length === 0 && <div className="text-slate-600">// aguardando eventos do cluster…<span className="evd-blink">▊</span></div>}
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

export default function AgentSwarmPanel({ agents, swarmMeta, feed }) {
  const { t } = useT();
  const safeAgents = agents || {};
  const entries = Object.entries(safeAgents).sort((a, b) => (a[1].createdAt || 0) - (b[1].createdAt || 0));
  if (!entries.length && !swarmMeta?.active) return null;
  const cols = entries.length > 6 ? 4 : entries.length > 3 ? 3 : Math.max(1, entries.length);

  return (
    <div className="rounded-xl border border-red-500/30 bg-[#0a0e14] p-4 evd-feed-enter">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
          <Boxes className="w-4 h-4" /> {t('evd.swarm_title')} · {entries.length}/{swarmMeta?.requested || 0} {t('evd.pods')}
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-[#26313f] bg-[#0f151d] px-2.5 py-1.5 font-mono text-[11px]">
          <span className="text-cyan-400">⎈</span>
          <span className="text-slate-300">eks-sandbox-datadog · ns/dogbank</span>
        </div>
      </div>

      <SwarmStatTiles agents={safeAgents} />
      <PodEventTicker feed={feed} />

      {entries.length > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
          {entries.map(([name, agent], i) => (
            <PodCard key={name} agent={agent} spawnDelayMs={i * 90} />
          ))}
        </div>
      )}
    </div>
  );
}
