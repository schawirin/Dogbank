import React, { useEffect, useRef, useState } from 'react';
import {
  Skull, LayoutDashboard, GitBranch, Terminal, Wifi, WifiOff,
  Maximize2, Minimize2, Crosshair, Globe, Network, ChevronDown, Plus, Shuffle,
} from 'lucide-react';
import useEvilDog from '../components/EvilDog/useEvilDog';
import ControlPanel from '../components/EvilDog/ControlPanel';
import AttackOrchestrator from '../components/EvilDog/AttackOrchestrator';
import PostExploitPanel from '../components/EvilDog/PostExploitPanel';
import { useT } from '../i18n';
import '../components/EvilDog/EvilDog.css';

const TABS = [
  { id: 'control', key: 'evd.tab_control', icon: LayoutDashboard },
  { id: 'orchestrator', key: 'evd.tab_orchestrator', icon: GitBranch },
  { id: 'postexploit', key: 'evd.tab_postexploit', icon: Terminal },
];

// Dark-themed PT/EN toggle (the app-wide LanguageToggle is light; EvilDog is dark,
// and it must also be reachable in fullscreen where the app header is hidden).
function LangToggleDark() {
  const { lang, setLang } = useT();
  return (
    <button
      onClick={() => setLang(lang === 'pt' ? 'en' : 'pt')}
      title={lang === 'pt' ? 'Switch to English' : 'Mudar para Português'}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#26313f] bg-[#0f151d] text-xs font-semibold text-slate-300 hover:text-green-400 hover:border-green-500/40"
    >
      <Globe className="w-3.5 h-3.5" /> {lang === 'pt' ? 'PT' : 'EN'}
    </button>
  );
}

function TargetSelector({ evd }) {
  const { t } = useT();
  const { config, target, changeTarget } = evd;
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState('');
  const [err, setErr] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const host = target?.address || '—';
  const add = async () => {
    if (!val.trim()) return;
    const res = await changeTarget(val.trim());
    if (res?.ok === false) setErr(res.error || t('evd.scope_err'));
    else { setErr(''); setVal(''); setOpen(false); }
  };
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#26313f] bg-[#0f151d] text-sm text-slate-200 hover:border-red-500/40">
        <Crosshair className="w-4 h-4 text-red-400" />
        <span className="font-mono">{host}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl border border-[#26313f] bg-[#0f151d] p-2 z-30 shadow-xl">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 px-2 py-1">{t('evd.targets')}</div>
          {(config?.targets || []).map((tg) => (
            <button key={tg} onClick={() => { changeTarget(tg); setOpen(false); }}
              className="w-full text-left px-2 py-1.5 rounded-md text-sm font-mono text-slate-300 hover:bg-[#131b25]">
              {tg}
            </button>
          ))}
          <div className="flex items-center gap-1 mt-2 px-1">
            <input value={val} onChange={(e) => { setVal(e.target.value); setErr(''); }}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder={t('evd.target_ph')}
              className="flex-1 bg-[#0b1017] border border-[#26313f] rounded-md px-2 py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-600" />
            <button onClick={add} className="p-1.5 rounded-md bg-red-500 hover:bg-red-400 text-white"><Plus className="w-4 h-4" /></button>
          </div>
          {err && <div className="text-[11px] text-red-400 px-2 mt-1">{err}</div>}
          <div className="text-[10px] text-slate-600 px-2 mt-1">{t('evd.lab_only')}</div>
        </div>
      )}
    </div>
  );
}

// Source-IP chip + "Rotate IP" (spoofs X-Forwarded-For to evade an AAP IP block).
function SourceIp({ evd }) {
  const { t } = useT();
  const [spinning, setSpinning] = useState(false);
  const rotate = async () => {
    setSpinning(true);
    await evd.rotateIp();
    setTimeout(() => setSpinning(false), 500);
  };
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-[#26313f] bg-[#0f151d] pl-2.5 pr-1 py-1">
      <span className="text-[10px] uppercase tracking-wider text-slate-500">{t('evd.source_ip')}</span>
      <span className="font-mono text-xs text-red-300">{evd.sourceIp || '—'}</span>
      <button onClick={rotate} title={t('evd.rotate_hint')}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-amber-300 border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20">
        <Shuffle className={`w-3.5 h-3.5 ${spinning ? 'animate-spin' : ''}`} /> {t('evd.rotate_ip')}
      </button>
    </div>
  );
}

function OperatorLogin({ evd }) {
  const [token, setToken] = useState('');
  if (!evd.authRequired) return null;
  const submit = async (event) => {
    event.preventDefault();
    const accepted = await evd.loginOperator(token);
    if (accepted) setToken('');
  };
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4" role="presentation">
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="operator-auth-title"
        className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-[#0f151d] p-5 shadow-2xl">
        <h2 id="operator-auth-title" className="text-lg font-bold text-slate-100">Autenticar operador do laboratório</h2>
        <p className="mt-2 text-sm text-slate-400">O token cria uma sessão temporária no servidor para operar o console. Ele não é salvo no navegador.</p>
        <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-slate-500" htmlFor="evildog-operator-token">Token do operador</label>
        <input id="evildog-operator-token" type="password" autoComplete="current-password" autoFocus value={token}
          onChange={(event) => setToken(event.target.value)} disabled={evd.authLoading}
          className="mt-1.5 w-full rounded-lg border border-[#33465a] bg-[#080b10] px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500" />
        {evd.authError && <div role="alert" className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">{evd.authError}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={evd.dismissOperatorLogin} disabled={evd.authLoading}
            className="rounded-lg border border-[#33465a] px-3 py-2 text-sm text-slate-300 hover:text-white disabled:opacity-50">Cancelar</button>
          <button type="submit" disabled={evd.authLoading}
            className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-black hover:bg-amber-400 disabled:opacity-50">{evd.authLoading ? 'Autenticando…' : 'Autenticar'}</button>
        </div>
      </form>
    </div>
  );
}

export default function EvilDogPage() {
  const { t } = useT();
  const [tab, setTab] = useState('orchestrator');
  const [maximized, setMaximized] = useState(false);
  const evd = useEvilDog();

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setMaximized(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const external = evd.target?.external_origin;

  const shell = maximized
    ? 'fixed inset-0 z-[9999] overflow-y-auto evd-scroll p-4 md:p-6'
    : 'evd-root -mx-4 -my-4 md:-mx-8 md:-my-8 min-h-[calc(100vh-73px)] p-4 md:p-6';

  return (
    <div className={`evd-root ${shell}`}>
      {/* top bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg border border-green-500/40 bg-green-500/10 flex items-center justify-center">
            <Skull className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-100 tracking-wide">EVIL<span className="text-green-400">DOG</span></h1>
              <span className="px-2 py-0.5 rounded border border-red-500/40 bg-red-500/10 text-red-400 text-[10px] font-bold tracking-wider">PEN-TEST MODE</span>
            </div>
            <div className="text-[11px] text-slate-500 tracking-wider">{t('evd.subtitle')}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <TargetSelector evd={evd} />
          <SourceIp evd={evd} />
          <span className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs
            ${external ? 'border-green-500/40 bg-green-500/10 text-green-400' : 'border-amber-500/40 bg-amber-500/10 text-amber-400'}`}>
            {external ? <Globe className="w-3.5 h-3.5" /> : <Network className="w-3.5 h-3.5" />}
            {external ? t('evd.internet') : t('evd.internal')}
          </span>
          <div className={`flex items-center gap-1.5 text-xs ${evd.connected ? 'text-green-400' : 'text-slate-500'}`}>
            {evd.connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {evd.connected ? t('evd.telemetry_live') : t('evd.offline')}
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-[#1e2733] bg-[#0f151d] p-1">
            {TABS.map(({ id, key, icon: Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                  ${tab === id ? 'bg-green-500/15 text-green-400' : 'text-slate-400 hover:text-slate-200'}`}>
                <Icon className="w-4 h-4" /> <span className="hidden sm:inline">{t(key)}</span>
              </button>
            ))}
          </div>
          <LangToggleDark />
          <button onClick={() => setMaximized((m) => !m)}
            title={maximized ? t('evd.restore') : t('evd.maximize')}
            className="p-2 rounded-lg border border-[#26313f] bg-[#0f151d] text-slate-300 hover:text-green-400 hover:border-green-500/40">
            {maximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {tab === 'control' && <ControlPanel evd={evd} />}
      {tab === 'orchestrator' && <AttackOrchestrator evd={evd} />}
      {tab === 'postexploit' && <PostExploitPanel evd={evd} />}

      <OperatorLogin evd={evd} />

      <div className="mt-6 text-center text-[11px] text-slate-600">{t('evd.footer')}</div>
    </div>
  );
}
