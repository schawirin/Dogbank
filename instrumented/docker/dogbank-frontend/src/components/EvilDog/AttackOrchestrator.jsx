import React, { useEffect, useRef } from 'react';
import {
  Radar, ListChecks, ShieldAlert, Terminal as TerminalIcon, Database, Unlock,
  DownloadCloud, FileCheck, Play, ChevronRight, Activity,
} from 'lucide-react';
import { levelClass } from './parts';

const NODES = [
  { id: 'RECON', sub: 'Target Discovery', group: 'recon', icon: Radar },
  { id: 'SCAN', sub: 'Port Scanner', group: 'recon', icon: ListChecks },
  { id: 'DETECT', sub: 'Vulnerability Scanner', group: 'vuln', icon: ShieldAlert },
  { id: 'PAYLOAD', sub: 'Payload Generator', group: 'payload', icon: TerminalIcon },
  { id: 'INJECT', sub: 'SQL Injection', group: 'exploit', icon: Database },
  { id: 'BYPASS', sub: 'Auth Bypass', group: 'exploit', icon: Unlock },
  { id: 'EXTRACT', sub: 'Data Exfiltration', group: 'final', icon: DownloadCloud },
  { id: 'REPORT', sub: 'Generate Report', group: 'final', icon: FileCheck },
];

const GROUP = {
  recon: { text: 'text-cyan-400', border: 'border-cyan-500/70', dot: 'bg-cyan-500', glow: 'shadow-[0_0_18px_rgba(56,189,248,0.35)]' },
  vuln: { text: 'text-amber-400', border: 'border-amber-500/70', dot: 'bg-amber-500', glow: 'shadow-[0_0_18px_rgba(245,158,11,0.35)]' },
  payload: { text: 'text-orange-400', border: 'border-orange-500/70', dot: 'bg-orange-500', glow: 'shadow-[0_0_18px_rgba(251,146,60,0.35)]' },
  exploit: { text: 'text-red-400', border: 'border-red-500/70', dot: 'bg-red-500', glow: 'shadow-[0_0_18px_rgba(239,68,68,0.35)]' },
  final: { text: 'text-green-400', border: 'border-green-500/70', dot: 'bg-green-500', glow: 'shadow-[0_0_18px_rgba(34,197,94,0.35)]' },
};

const LEGEND = [
  { label: 'Recon & Discovery', dot: 'bg-cyan-500' },
  { label: 'Vulnerability Check', dot: 'bg-amber-500' },
  { label: 'Payload Structuring', dot: 'bg-orange-500' },
  { label: 'Active Exploit', dot: 'bg-red-500' },
  { label: 'Exfil & Final', dot: 'bg-green-500' },
];

const StatusDot = ({ state, group }) => {
  if (state === 'success') return <span className="w-2.5 h-2.5 rounded-full bg-green-500" />;
  if (state === 'fail') return <span className="w-2.5 h-2.5 rounded-full bg-red-500" />;
  if (state === 'active') return <span className={`w-2.5 h-2.5 rounded-full ${GROUP[group].dot} animate-ping`} />;
  return <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />;
};

const Node = ({ node, state }) => {
  const g = GROUP[node.group];
  const Icon = node.icon;
  const border =
    state === 'idle' || !state ? 'border-[#1e2733]'
      : state === 'fail' ? 'border-red-500/70'
        : g.border;
  const glow = state === 'active' ? `${g.glow} evd-node-active` : '';
  return (
    <div className={`relative rounded-xl border bg-[#0f151d] p-4 w-[200px] shrink-0 ${border} ${glow}`} style={{ color: 'inherit' }}>
      <div className="absolute top-3 right-3"><StatusDot state={state} group={node.group} /></div>
      <div className={`w-9 h-9 rounded-lg border border-[#26313f] bg-[#0b1017] flex items-center justify-center mb-3 ${g.text}`}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div className="font-bold text-slate-100 tracking-wide">{node.id}</div>
      <div className="text-xs text-slate-500 mt-0.5">{node.sub}</div>
      {state === 'success' && <div className={`text-[11px] mt-2 ${g.text}`}>✓ concluído</div>}
      {state === 'active' && <div className="text-[11px] mt-2 text-slate-400">executando…</div>}
      {state === 'fail' && <div className="text-[11px] mt-2 text-red-400">alvo seguro</div>}
    </div>
  );
};

const TelemetryFeed = ({ feed }) => {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [feed]);
  return (
    <div className="rounded-xl border border-[#1e2733] bg-[#080b10] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1e2733]">
        <div className="flex items-center gap-2 text-slate-200 text-sm font-bold">
          <Activity className="w-4 h-4 text-green-400" /> Live Telemetry Feed
        </div>
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      </div>
      <div ref={ref} className="evd-scroll p-4 overflow-y-auto text-[12px] leading-relaxed" style={{ height: '190px' }}>
        {feed.length === 0 && <div className="text-slate-600">// sem eventos — clique em RUN PIPELINE<span className="evd-blink">▊</span></div>}
        {feed.slice(-80).map((ev, i) => (
          <div key={i} className="evd-feed-enter">
            <span className={ev.level === 'critical' ? 'text-red-400' : ev.level === 'success' ? 'text-green-400' : ev.level === 'warn' ? 'text-amber-400' : 'text-cyan-400'}>
              [{ev.ts}]
            </span>{' '}
            <span className={levelClass(ev.level)}>{ev.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function AttackOrchestrator({ evd }) {
  const { nodeStates, feed, runPipeline, running } = evd;
  const done = NODES.filter((n) => nodeStates[n.id] === 'success').length;
  const isRunning = running === 'pipeline' || NODES.some((n) => nodeStates[n.id] === 'active');
  const vulnerable = nodeStates.DETECT === 'success';

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="rounded-xl border border-[#1e2733] bg-[#0f151d] p-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-100 tracking-wide">EVILDOG :: ATTACK ORCHESTRATOR</h2>
          <p className="text-sm text-slate-400 mt-0.5">Active Flow: SQL Injection Pipeline (ambiente de emulação de ataque ao vivo)</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1.5 rounded-lg border text-xs font-bold tracking-wider
            ${done === NODES.length ? 'text-green-400 border-green-500/40 bg-green-500/10'
              : isRunning ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
                : 'text-slate-400 border-slate-600/40 bg-slate-700/20'}`}>
            {done === NODES.length ? `● COMPLETED (${done}/${NODES.length})` : isRunning ? `● RUNNING (${done}/${NODES.length})` : `○ IDLE (${done}/${NODES.length})`}
          </span>
          <button
            onClick={runPipeline}
            disabled={isRunning}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all
              ${isRunning ? 'bg-green-900/40 text-green-300 cursor-wait' : 'bg-green-500 hover:bg-green-400 text-black shadow-lg shadow-green-500/20'}`}
          >
            <Play className="w-4 h-4" /> {isRunning ? 'RODANDO…' : 'RUN PIPELINE'}
          </button>
        </div>
      </div>

      {/* pipeline graph */}
      <div className="rounded-xl border border-[#1e2733] bg-[#0a0e14] evd-grid p-6 overflow-x-auto">
        <div className="flex items-stretch gap-2 min-w-max">
          {NODES.map((node, i) => (
            <React.Fragment key={node.id}>
              <Node node={node} state={nodeStates[node.id]} />
              {i < NODES.length - 1 && (
                <div className="flex items-center px-1 shrink-0">
                  {/* conditional fork after DETECT */}
                  {node.id === 'DETECT' ? (
                    <div className="flex flex-col items-center gap-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${vulnerable ? 'text-amber-400 border-amber-500/40 bg-amber-500/10' : 'text-slate-500 border-slate-600/40'}`}>
                        Vulnerable?
                      </span>
                      <span className={`text-[10px] font-bold ${vulnerable ? 'text-green-400' : 'text-slate-600'}`}>
                        {vulnerable ? 'YES ↓' : '…'}
                      </span>
                    </div>
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-600" />
                  )}
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* legend + telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-xl border border-[#1e2733] bg-[#0f151d] p-5">
          <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-3">Flow Color Legend</div>
          <div className="grid grid-cols-2 gap-y-3 gap-x-4">
            {LEGEND.map((l) => (
              <div key={l.label} className="flex items-center gap-2 text-sm text-slate-300">
                <span className={`w-2.5 h-2.5 rounded-full ${l.dot}`} /> {l.label}
              </div>
            ))}
          </div>
        </div>
        <TelemetryFeed feed={feed} />
      </div>
    </div>
  );
}
