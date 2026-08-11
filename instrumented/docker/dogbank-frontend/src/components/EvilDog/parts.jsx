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
          <div className="text-slate-600">// aguardando comandos do operador…<span className="evd-blink">▊</span></div>
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
