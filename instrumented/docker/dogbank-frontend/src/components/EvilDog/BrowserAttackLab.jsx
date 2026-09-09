import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Maximize2, Minimize2, RefreshCw, ShieldAlert } from 'lucide-react';

const buildAttackerUrl = (take) => {
  const secure = window.location.protocol === 'https:';
  const protocol = secure ? 'https:' : 'http:';
  const port = secure ? '3001' : '3002';
  const params = new URLSearchParams({
    embedded: '1',
    target: window.location.origin,
    take: String(take),
  });
  return `${protocol}//${window.location.hostname}:${port}/?${params.toString()}`;
};

export default function BrowserAttackLab() {
  const [expanded, setExpanded] = useState(false);
  const [take, setTake] = useState(() => Date.now());
  const attackerUrl = useMemo(() => buildAttackerUrl(take), [take]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, []);

  const shell = expanded
    ? 'fixed inset-0 z-[10001] overflow-y-auto bg-[#070b10] p-3 md:p-5'
    : 'rounded-2xl border border-[#253140] bg-[#0b1118] p-3 md:p-4';

  return (
    <section className={shell} aria-label="Browser Trust attack module">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#253140] bg-[#0d141d] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-500/35 bg-red-500/10">
            <ShieldAlert className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <div className="font-mono text-sm font-black tracking-wider text-slate-100">BROWSER TRUST EXPLOIT</div>
            <div className="text-[11px] text-slate-500">Pipeline isolada · framing + postMessage · dados sintéticos</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTake(Date.now())}
            className="flex items-center gap-1.5 rounded-lg border border-[#33465a] bg-[#0f151d] px-3 py-2 text-xs font-semibold text-slate-300 hover:border-green-500/40 hover:text-green-400"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Novo take
          </button>
          <button
            type="button"
            onClick={() => window.open(attackerUrl, '_blank', 'noopener,noreferrer')}
            className="flex items-center gap-1.5 rounded-lg border border-[#33465a] bg-[#0f151d] px-3 py-2 text-xs font-semibold text-slate-300 hover:border-green-500/40 hover:text-green-400"
            title="Abrir este módulo em uma nova janela"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Janela
          </button>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="flex items-center gap-1.5 rounded-lg border border-green-500/35 bg-green-500/10 px-3 py-2 text-xs font-semibold text-green-400 hover:bg-green-500/20"
            title={expanded ? 'Restaurar módulo' : 'Expandir módulo'}
          >
            {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            {expanded ? 'Restaurar' : 'Expandir'}
          </button>
        </div>
      </div>

      <iframe
        key={take}
        src={attackerUrl}
        title="EvilDog Browser Trust Lab"
        className={`w-full rounded-xl border border-[#253140] bg-[#070b10] ${expanded ? 'h-[calc(100vh-105px)] min-h-[680px]' : 'h-[calc(100vh-230px)] min-h-[720px] max-h-[860px]'}`}
        allow="clipboard-read; clipboard-write"
      />
    </section>
  );
}
