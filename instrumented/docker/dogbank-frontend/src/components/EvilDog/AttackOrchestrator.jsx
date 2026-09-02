import React, { useEffect, useRef, useState } from 'react';
import {
  Radar, ListChecks, ShieldAlert, Terminal as TerminalIcon, Database, KeyRound,
  Banknote, FileCheck, XCircle, Play, Activity, Eye, ShieldX, Shuffle, Layers, Boxes, RotateCcw,
} from 'lucide-react';
import { levelClass, EvilBot, SwarmSizeStepper } from './parts';
import NodeModal from './NodeModals';
import AgentSwarmPanel from './AgentSwarmPanel';
import { useT } from '../../i18n';

// Nodes that open a detail modal on click.
const CLICKABLE = new Set(['SCAN', 'DETECT', 'REPORT', 'TRANSFER']);

// ---- fixed design canvas (scaled to fit) -----------------------------------
const STAGE_W = 1520;
const STAGE_H = 600;

const COLORS = {
  recon: '#38bdf8', vuln: '#f59e0b', payload: '#fb923c',
  exploit: '#ef4444', final: '#22c55e', skip: '#475569',
};

// node id -> layout + meta
const NODES = [
  { id: 'RECON', x: 24, y: 352, group: 'recon', role: 'nmap · discovery', icon: Radar },
  { id: 'SCAN', x: 268, y: 352, group: 'recon', role: 'nmap -sV · port scan', icon: ListChecks },
  { id: 'DETECT', x: 512, y: 352, group: 'vuln', role: 'sqlmap · vuln scan', icon: ShieldAlert },
  { id: 'PAYLOAD', x: 904, y: 110, group: 'payload', role: 'Payload Generator', icon: TerminalIcon },
  { id: 'INJECT', x: 1136, y: 110, group: 'exploit', role: 'SQLi · exfil credenciais', icon: Database },
  { id: 'ATO', x: 1332, y: 110, group: 'exploit', role: 'Account Takeover', icon: KeyRound },
  { id: 'REPORT', x: 1136, y: 352, group: 'final', role: 'Generate Report', icon: FileCheck },
  { id: 'TRANSFER', x: 1332, y: 352, group: 'exploit', role: 'PIX indevido', icon: Banknote },
  { id: 'SKIP', x: 904, y: 470, group: 'skip', role: 'Exploit Skipped', icon: XCircle, small: true },
];
const NW = 188, NH = 116;
// decision diamond
const VULN = { x: 737, y: 372, w: 150, h: 76 };

const EDGES = [
  { p: [212, 410, 268, 410], g: 'recon', t: 'SCAN' },
  { p: [456, 410, 512, 410], g: 'recon', t: 'DETECT' },
  { p: [700, 410, 737, 410], g: 'vuln', t: 'DETECT' },
  { p: [887, 410, 904, 168], g: 'final', t: 'PAYLOAD', label: 'YES', lx: 905, ly: 300 },
  { p: [1092, 168, 1136, 168], g: 'payload', t: 'INJECT' },
  { p: [1324, 168, 1332, 168], g: 'exploit', t: 'ATO' },
  { p: [1426, 226, 1426, 352], g: 'exploit', t: 'TRANSFER' },
  { p: [1332, 410, 1324, 410], g: 'final', t: 'REPORT' },
  { p: [887, 430, 904, 518], g: 'skip', t: 'SKIP', label: 'NO', lx: 838, ly: 505, dim: true },
];

function edgePath(x1, y1, x2, y2, r = 14) {
  if (Math.abs(y1 - y2) < 1 || Math.abs(x1 - x2) < 1) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const midx = (x1 + x2) / 2, dy = y2 > y1 ? 1 : -1;
  return `M ${x1} ${y1} L ${midx - r} ${y1} Q ${midx} ${y1} ${midx} ${y1 + dy * r} `
    + `L ${midx} ${y2 - dy * r} Q ${midx} ${y2} ${midx + r} ${y2} L ${x2} ${y2}`;
}

function detailFor(id, st, address, records, outcome) {
  // A failure is not automatically an AAP block. The backend classifies the
  // terminal result so the screen does not attribute an application user-block,
  // rate limit, or backend incident to Datadog AAP.
  if (st === 'fail' && id !== 'DETECT' && id !== 'SKIP') {
    if (outcome?.kind === 'AAP_BLOCKED') return '🛡️ Bloqueado pela AAP';
    if (outcome?.kind === 'USER_BLOCKED') return '🛡️ Contido: usuário bloqueado';
    if (outcome?.kind === 'RATE_LIMITED') return '⏳ Rate limit aplicado';
    if (outcome?.kind === 'AAP_NOT_ENFORCED') return '⚠️ Bloqueio AAP não aplicado';
    if (outcome?.kind === 'BACKEND_ERROR') return '⚠️ Erro do backend';
  }
  switch (id) {
    case 'RECON': return st === 'active' ? 'nmap -sn…' : (address || 'lab.dogbank.dog');
    case 'SCAN': return st === 'active' ? 'nmap -sV…' : st === 'idle' || !st ? '—' : 'Ports: 8088, 8084, 8089';
    case 'DETECT': return st === 'active' ? 'sqlmap…' : st === 'success' ? 'SQLi confirmada' : st === 'fail' ? 'Target secure' : '—';
    case 'PAYLOAD': return 'UNION SELECT cpf:senha…';
    case 'INJECT': return st === 'active' ? 'exfiltrando…' : st === 'success' ? 'senhas roubadas' : '—';
    case 'ATO': return st === 'active' ? 'login c/ senha roubada…' : st === 'success' ? 'conta comprometida!' : '—';
    case 'TRANSFER': return st === 'active' ? 'PIX indevido…' : st === 'success' ? 'PIX executado' : records != null && records > 0 ? `${records} vazados` : '—';
    case 'REPORT': return st === 'success' ? 'cadeia completa' : '—';
    case 'SKIP': return 'Target secure';
    default: return '';
  }
}

const StatusDot = ({ state, color }) => {
  const cls = state === 'success' ? 'bg-green-500'
    : state === 'fail' ? 'bg-red-500'
      : state === 'active' ? 'animate-ping' : 'bg-slate-600';
  return <span className={`w-2.5 h-2.5 rounded-full ${cls}`} style={state === 'active' ? { background: color } : undefined} />;
};

function Node({ node, state, address, records, outcome, clickable, onClick }) {
  const c = COLORS[node.group];
  const Icon = node.icon;
  const active = state === 'active';
  const done = state === 'success';
  const failed = state === 'fail' && node.id !== 'DETECT';
  const border = failed ? '#ef4444' : state === 'idle' || !state ? '#1e2733' : node.group === 'skip' ? '#26313f' : c;
  const stateCls = active ? 'evd-node-active' : done ? 'evd-node-done' : failed ? 'evd-node-fail' : '';
  const h = node.small ? 96 : NH;
  const detail = detailFor(node.id, state, address, records, outcome);
  const detailColor = failed ? '#f87171' : done || active ? c : '#64748b';
  return (
    <div
      onClick={clickable ? onClick : undefined}
      className={`evd-node absolute rounded-2xl bg-[#0f151d] px-4 py-3 overflow-hidden ${stateCls} ${clickable ? 'cursor-pointer hover:brightness-125' : ''}`}
      style={{
        left: node.x, top: node.y, width: NW, height: h,
        border: `1.5px solid ${border}`,
        '--evd-glow': failed ? '#ef4444' : c,
        opacity: node.group === 'skip' && state !== 'active' && state !== 'success' ? 0.55 : 1,
      }}
    >
      <div className="flex items-start justify-between">
        <div className="w-9 h-9 rounded-lg border border-[#26313f] bg-[#0b1017] flex items-center justify-center"
             style={{ color: failed ? '#ef4444' : c }}>
          {failed ? <ShieldX className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
        </div>
        <StatusDot state={state} color={c} />
      </div>
      {clickable && (
        <span className="absolute bottom-2 right-3 flex items-center gap-1 text-[9px] text-slate-500">
          <Eye className="w-3 h-3" /> detalhes
        </span>
      )}
      <div className="mt-2 font-bold text-slate-100 tracking-wide leading-none">{node.id}</div>
      <div className="text-[11px] text-slate-500 mt-1 leading-none">{node.role}</div>
      <div className="text-[11.5px] mt-1.5 font-semibold leading-tight truncate" style={{ color: detailColor }}>
        {detail}
      </div>
      {active && <div className="evd-node-bar"><i style={{ background: c }} /></div>}
    </div>
  );
}

function Diamond({ state }) {
  const vulnerable = state === 'success';
  const c = COLORS.vuln;
  return (
    <div className="absolute flex flex-col items-center justify-center rounded-xl bg-[#0f151d] px-3"
         style={{ left: VULN.x, top: VULN.y, width: VULN.w, height: VULN.h, border: `1.5px solid ${c}` }}>
      <div className="text-[13px] font-bold" style={{ color: c }}>Vulnerable?</div>
      <div className="text-[10px] text-slate-500">Conditional branch</div>
      {state && state !== 'idle' && (
        <div className={`text-[10px] font-bold mt-0.5 ${vulnerable ? 'text-green-400' : 'text-slate-500'}`}>
          {vulnerable ? 'YES ↑' : 'checando…'}
        </div>
      )}
    </div>
  );
}

const LEGEND = [
  ['evd.legend_recon', COLORS.recon], ['evd.legend_vuln', COLORS.vuln],
  ['evd.legend_payload', COLORS.payload], ['evd.legend_exploit', COLORS.exploit],
  ['evd.legend_final', COLORS.final],
];

function TelemetryFeed({ feed }) {
  const { t } = useT();
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [feed]);
  return (
    <div className="rounded-xl border border-[#1e2733] bg-[#080b10] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1e2733]">
        <div className="flex items-center gap-2 text-slate-200 text-sm font-bold">
          <Activity className="w-4 h-4 text-green-400" /> {t('evd.feed_title')}
        </div>
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      </div>
      <div ref={ref} className="evd-scroll p-4 overflow-y-auto text-[12px] leading-relaxed" style={{ height: '190px' }}>
        {feed.length === 0 && <div className="text-slate-600">{t('evd.feed_empty')}<span className="evd-blink">▊</span></div>}
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
}

function OutcomeNotice({ outcome, error, onDismiss }) {
  const item = error || outcome;
  if (!item?.kind) return null;
  const config = {
    SUCCESS: ['border-green-500/45 bg-green-500/10 text-green-100', 'Pipeline concluído com sucesso'],
    NO_EXPLOIT: ['border-cyan-500/45 bg-cyan-500/10 text-cyan-100', 'Alvo não vulnerável; exploração ignorada'],
    AAP_BLOCKED: ['border-red-500/45 bg-red-500/10 text-red-200', 'AAP bloqueou a requisição'],
    USER_BLOCKED: ['border-amber-500/45 bg-amber-500/10 text-amber-100', 'Contenção aplicada: usuário bloqueado'],
    RATE_LIMITED: ['border-amber-500/45 bg-amber-500/10 text-amber-100', 'Rate limit interrompeu a ação'],
    AAP_NOT_ENFORCED: ['border-amber-500/45 bg-amber-500/10 text-amber-100', 'Bloqueio AAP não confirmado'],
    BACKEND_ERROR: ['border-orange-500/45 bg-orange-500/10 text-orange-100', 'Falha técnica no backend'],
    RUN_ALREADY_ACTIVE: ['border-cyan-500/45 bg-cyan-500/10 text-cyan-100', 'Já existe uma execução em andamento'],
  }[item.kind] || ['border-slate-500/45 bg-slate-500/10 text-slate-100', 'Ação não concluída'];
  return (
    <div role="alert" className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${config[0]}`}>
      <div><strong>{config[1]}.</strong>{item.message ? ` ${item.message}` : ''}</div>
      <button onClick={onDismiss} className="text-xs opacity-70 hover:opacity-100">fechar</button>
    </div>
  );
}

function EscalationBanner({ evd }) {
  const { t } = useT();
  const [swarmSize, setSwarmSize] = useState(5);
  const busy = evd.escalating || evd.running === 'pipeline';
  const changeIp = async () => {
    const result = await evd.rotateIp();
    if (result) await evd.runPipeline();
  };
  return (
    <div className="rounded-xl border border-red-500/50 bg-red-500/10 p-4 evd-feed-enter">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <EvilBot size={34} className="text-red-400 evd-bot-bob" />
          <div>
            <div className="text-red-400 font-black tracking-widest text-lg leading-none">{t('evd.esc_fail_title')}</div>
            <div className="text-red-200/80 text-sm mt-1">{t('evd.esc_blocked_msg')}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={changeIp} disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 text-sm font-semibold hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed">
            <Shuffle className="w-4 h-4" /> {t('evd.esc_change_ip')}
          </button>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-500">{t('evd.esc_swarm_size')}</span>
            <SwarmSizeStepper value={swarmSize} onChange={setSwarmSize} />
          </div>
          <button onClick={() => evd.escalate(swarmSize)} disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm font-bold hover:bg-red-400 shadow-lg shadow-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed">
            <Layers className="w-4 h-4" /> {t('evd.esc_escalate')} ({swarmSize})
          </button>
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-red-500/20 text-[11px] text-red-200/70">
        <Boxes className="w-3.5 h-3.5" /> {t('evd.esc_real_hint')}
      </div>
      {evd.escalateError && (
        <div role="alert" className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Não foi possível iniciar o enxame: {evd.escalateError.detail || evd.escalateError.kind}.
        </div>
      )}
    </div>
  );
}

export default function AttackOrchestrator({ evd }) {
  const { t } = useT();
  const { nodeStates, feed, runPipeline, running, target, loot, blocked, pipelineOutcome, operationError, escalating, agents, swarmMeta } = evd;
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [modal, setModal] = useState(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const compute = () => setScale(Math.max(0.34, Math.min(1.18, el.clientWidth / STAGE_W)));
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const done = NODES.filter((n) => n.id !== 'SKIP' && nodeStates[n.id] === 'success').length;
  const total = NODES.filter((n) => n.id !== 'SKIP').length;
  const isRunning = running === 'pipeline' || NODES.some((n) => nodeStates[n.id] === 'active');
  const failed = NODES.some((n) => nodeStates[n.id] === 'fail' && n.id !== 'DETECT');
  const address = target?.address;
  const records = loot?.summary?.records;
  const hasSwarm = Object.keys(agents || {}).length > 0 || swarmMeta?.active || escalating;

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="rounded-xl border border-[#1e2733] bg-[#0f151d] p-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-100 tracking-wide">EVILDOG :: ATTACK ORCHESTRATOR</h2>
          <p className="text-sm text-slate-400 mt-0.5">{t('evd.orch_subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => evd.prepareNewTake({ rotate: false })}
            disabled={isRunning || evd.preparing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-600/50 bg-slate-800/50 text-slate-300 text-xs font-bold hover:bg-slate-700/60 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw className={`w-4 h-4 ${evd.preparing ? 'animate-spin' : ''}`} />
            {evd.preparing ? t('evd.preparing_take') : t('evd.new_take')}
          </button>
          <span className={`px-3 py-1.5 rounded-lg border text-xs font-bold tracking-wider
            ${failed ? 'text-red-400 border-red-500/40 bg-red-500/10'
              : done === total ? 'text-green-400 border-green-500/40 bg-green-500/10'
                : isRunning ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
                  : 'text-slate-400 border-slate-600/40 bg-slate-700/20'}`}>
            {failed ? `● ${t('evd.st_blocked')}`
              : done === total ? `● ${t('evd.st_completed')} (${done}/${total})`
                : isRunning ? `● ${t('evd.st_running')} (${done}/${total})` : `○ ${t('evd.st_idle')} (${done}/${total})`}
          </span>
          <button
            onClick={runPipeline}
            disabled={isRunning}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all
              ${isRunning ? 'bg-green-900/40 text-green-300 cursor-wait' : 'bg-green-500 hover:bg-green-400 text-black shadow-lg shadow-green-500/20'}`}
          >
            <Play className="w-4 h-4" /> {isRunning ? t('evd.running') : t('evd.run_pipeline')}
          </button>
        </div>
      </div>

      <OutcomeNotice outcome={pipelineOutcome} error={operationError} onDismiss={evd.clearOutcome} />

      {/* escalation: on AAP block, offer change-IP / escalate to N simultaneous IPs */}
      {blocked && !hasSwarm && <EscalationBanner evd={evd} />}
      {/* Antes o painel era gated em `escalating`, que virava false ao rodar o pipeline de
          novo -- o enxame sumia da tela levando o relatório. Agora ele fica enquanto
          houver agentes (ou rodada ativa) e só sai quando o usuário fecha. */}
      {hasSwarm && (
        <AgentSwarmPanel
          agents={agents}
          swarmMeta={swarmMeta}
          feed={feed}
          escalateError={evd.escalateError}
          onRerun={(n) => evd.escalate(n)}
          onDismiss={evd.dismissSwarm}
        />
      )}

      {/* pipeline canvas (scaled to fit) */}
      <div ref={wrapRef} className="rounded-xl border border-[#1e2733] bg-[#0a0e14] evd-grid overflow-hidden">
        <div style={{ height: STAGE_H * scale, position: 'relative' }}>
          <div style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute' }}>
            {/* connectors */}
            <svg width={STAGE_W} height={STAGE_H} className="absolute inset-0 pointer-events-none">
              {EDGES.map((e, i) => {
                const [x1, y1, x2, y2] = e.p;
                const col = COLORS[e.g];
                const lit = nodeStates[e.t] === 'success' || nodeStates[e.t] === 'active';
                const op = e.dim ? (lit ? 0.7 : 0.25) : (lit ? 1 : 0.4);
                return (
                  <g key={i} style={{ opacity: op }}>
                    <path d={edgePath(x1, y1, x2, y2)} fill="none" stroke={col} strokeWidth="2"
                          style={lit ? { filter: `drop-shadow(0 0 4px ${col})` } : undefined} />
                    <circle cx={x1} cy={y1} r="3.5" fill={col} />
                    <circle cx={x2} cy={y2} r="3.5" fill={col} />
                    {e.label && (
                      <g>
                        <rect x={e.lx - 15} y={e.ly - 10} width="30" height="18" rx="4"
                              fill="#0f151d" stroke={col} strokeOpacity="0.5" />
                        <text x={e.lx} y={e.ly + 3} textAnchor="middle" fontSize="10" fontWeight="700"
                              fill={col} fontFamily="ui-monospace, monospace">{e.label}</text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
            {/* nodes */}
            {NODES.map((n) => (
              <Node key={n.id} node={n} state={nodeStates[n.id]} address={address} records={records}
                outcome={pipelineOutcome} clickable={CLICKABLE.has(n.id)} onClick={() => setModal(n.id)} />
            ))}
            <Diamond state={nodeStates.DETECT} />
          </div>
        </div>
      </div>

      {/* legend + telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#1e2733] bg-[#0f151d] p-5">
          <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-3">{t('evd.legend_title')}</div>
          <div className="grid grid-cols-2 gap-y-3 gap-x-4">
            {LEGEND.map(([labelKey, col]) => (
              <div key={labelKey} className="flex items-center gap-2 text-sm text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: col }} /> {t(labelKey)}
              </div>
            ))}
          </div>
          {records > 0 && (
            <div className="mt-4 pt-3 border-t border-[#1e2733] text-sm text-slate-300">
              <span className="text-green-400 font-bold">{records}</span> {t('evd.records_exfil')} ·{' '}
              <span className="text-red-400 font-bold">{loot?.secrets?.length || 0}</span> {t('evd.secrets')} ·{' '}
              {t('evd.see_postexploit')}
            </div>
          )}
        </div>
        <TelemetryFeed feed={feed} />
      </div>

      <NodeModal node={modal} onClose={() => setModal(null)} />
    </div>
  );
}
