import React, { useEffect, useRef } from 'react';

// Level -> text color (attack console palette)
export const levelClass = (level) => ({
  success: 'text-green-400',
  critical: 'text-red-400',
  warn: 'text-amber-400',
  info: 'text-slate-400',
}[level] || 'text-slate-400');

const levelTag = (level) => ({
  success: '[+]',
  critical: '[!]',
  warn: '[-]',
  info: '[*]',
}[level] || '[*]');

// Robô do mal (agente) — SVG inline, sem depender de imagem externa.
// Shared here (rather than in AttackOrchestrator.jsx) so both the pipeline
// escalation banner and AgentSwarmPanel's pod cards can reuse it without a
// circular import between the two component files.
export const EvilBot = ({ size = 30, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
    <line x1="16" y1="3.5" x2="16" y2="9" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="16" cy="3" r="2" fill="#ef4444" />
    <rect x="6.5" y="9" width="19" height="15" rx="3.5" fill="#160c0f" stroke="currentColor" strokeWidth="1.6" />
    <rect x="3" y="13" width="3.5" height="6" rx="1.2" fill="currentColor" />
    <rect x="25.5" y="13" width="3.5" height="6" rx="1.2" fill="currentColor" />
    <path d="M9.5 13.2 L14 15" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
    <path d="M22.5 13.2 L18 15" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="16.5" r="1.9" fill="#ef4444" />
    <circle cx="20" cy="16.5" r="1.9" fill="#ef4444" />
    <rect x="10.5" y="20" width="11" height="2.6" rx="1" fill="#7f1d1d" />
    <line x1="13" y1="20" x2="13" y2="22.6" stroke="#160c0f" strokeWidth="0.9" />
    <line x1="16" y1="20" x2="16" y2="22.6" stroke="#160c0f" strokeWidth="0.9" />
    <line x1="19" y1="20" x2="19" y2="22.6" stroke="#160c0f" strokeWidth="0.9" />
  </svg>
);

// Tamanhos de enxame oferecidos na UI (o backend limita em MAX_JOBS_PER_ESCALATE).
// Vive aqui porque tanto o banner de escalação quanto o painel do enxame (que agora
// permite rodar outra rodada) precisam do mesmo seletor.
export const SWARM_SIZES = [3, 5, 8];

export const SwarmSizeStepper = ({ value, onChange, disabled = false }) => (
  <div className="flex items-center gap-1 rounded-lg border border-[#26313f] bg-[#0f151d] p-1">
    {SWARM_SIZES.map((n) => (
      <button
        key={n}
        onClick={() => onChange(n)}
        disabled={disabled}
        className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed
          ${value === n ? 'bg-red-500/20 text-red-300 border border-red-500/40' : 'text-slate-400 border border-transparent hover:text-slate-200'}`}
      >
        {n}
      </button>
    ))}
  </div>
);

export const Dot = ({ color = 'bg-green-500', pulse = false }) => (
  <span className={`inline-block w-2 h-2 rounded-full ${color} ${pulse ? 'animate-pulse' : ''}`} />
);

export const Badge = ({ children, color = 'green' }) => {
  const map = {
    green: 'text-green-400 border-green-500/40 bg-green-500/10',
    red: 'text-red-400 border-red-500/40 bg-red-500/10',
    amber: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
    slate: 'text-slate-400 border-slate-600/50 bg-slate-700/20',
  };
  return (
    <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold tracking-wider uppercase ${map[color] || map.green}`}>
      {children}
    </span>
  );
};

/**
 * Live terminal that renders the SSE telemetry feed with auto-scroll.
 */
export const Terminal = ({ feed = [], className = '', minHeight = '260px', title = 'STD_OUT (LIVE)' }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [feed]);

  return (
    <div className={`rounded-xl border border-[#1e2733] bg-[#080b10] overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1e2733]">
        <div className="flex items-center gap-2 text-green-400 text-sm font-bold">
          <span>&gt;_</span> Exploit Output
        </div>
        <span className="text-[10px] tracking-widest text-slate-500 uppercase">{title}</span>
      </div>
      <div ref={ref} className="evd-scroll p-4 overflow-y-auto text-[12.5px] leading-relaxed" style={{ minHeight, maxHeight: '42vh' }}>
        {feed.length === 0 && (
          <div className="text-slate-600">{'// aguardando comandos do operador…'}<span className="evd-blink">▊</span></div>
        )}
        {feed.map((ev, i) => (
          <div key={i} className={`evd-feed-enter ${levelClass(ev.level)}`}>
            <span className="text-slate-600">{ev.ts} </span>
            <span className="opacity-80">{levelTag(ev.level)}</span>{' '}
            {ev.message}
          </div>
        ))}
        {feed.length > 0 && <span className="text-green-400 evd-blink">▊</span>}
      </div>
    </div>
  );
};
