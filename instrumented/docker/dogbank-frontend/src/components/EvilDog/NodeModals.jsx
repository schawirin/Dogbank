import React, { useEffect, useState } from 'react';
import {
  X, ShieldAlert, Radar, FileWarning, Users, KeyRound, Banknote, Droplets,
  Server, AlertTriangle, Bug, Lock, ExternalLink,
} from 'lucide-react';
import evilDogService from '../../services/evilDogService';

const SEV = {
  critical: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/40', dot: 'bg-red-500', label: 'CRÍTICA' },
  high: { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/40', dot: 'bg-orange-500', label: 'ALTA' },
  medium: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/40', dot: 'bg-amber-500', label: 'MÉDIA' },
  low: { text: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/40', dot: 'bg-slate-500', label: 'BAIXA' },
};
const mask = (s, keep = 3) => (s && s.length > keep ? '•'.repeat(Math.max(0, s.length - keep)) + s.slice(-keep) : s);

function Shell({ title, icon: Icon, accent, onClose, children }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 evd-feed-enter" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[88vh] overflow-hidden rounded-2xl border border-[#26313f] bg-[#0c1119] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#1e2733]" style={{ background: `${accent}12` }}>
          <div className="flex items-center gap-2 font-bold text-slate-100">
            <Icon className="w-5 h-5" style={{ color: accent }} /> {title}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-[#1e2733]"><X className="w-4 h-4" /></button>
        </div>
        <div className="evd-scroll overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function ScanPanel({ onClose }) {
  const [d, setD] = useState(null);
  useEffect(() => { evilDogService.getScan().then(setD).catch(() => {}); }, []);
  return (
    <Shell title="SCAN · Superfície de ataque & oportunidades" icon={Radar} accent="#38bdf8" onClose={onClose}>
      <div className="text-sm text-slate-400 mb-4">Alvo <span className="text-cyan-300 font-mono">{d?.target || '…'}</span> · {d?.attack_surface || 0} vetores mapeados</div>
      <div className="space-y-2.5">
        {(d?.opportunities || []).map((o, i) => {
          const s = SEV[o.severity] || SEV.medium;
          return (
            <div key={i} className={`rounded-lg border ${s.border} ${s.bg} p-3 flex items-start gap-3`}>
              <span className={`mt-1 w-2.5 h-2.5 rounded-full ${s.dot}`} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-100">{o.category}</span>
                  <span className={`text-[10px] font-bold ${s.text}`}>{s.label}</span>
                </div>
                <div className="text-sm text-slate-400 mt-0.5">{o.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {(d?.open_ports || []).map((p) => (
          <span key={p.port} className="px-2 py-1 rounded-md bg-[#131b25] border border-[#26313f] text-xs">
            <span className="text-cyan-400 font-bold">{p.port}</span><span className="text-slate-500"> / {p.service}</span>
          </span>
        ))}
      </div>
    </Shell>
  );
}

function VulnPanel({ onClose }) {
  const [d, setD] = useState(null);
  useEffect(() => { evilDogService.getVulnerabilities().then(setD).catch(() => {}); }, []);
  const by = d?.by_severity || {};
  return (
    <Shell title="DETECT · Vulnerabilidades encontradas" icon={ShieldAlert} accent="#f59e0b" onClose={onClose}>
      <div className="flex gap-2 mb-4">
        {['critical', 'high', 'medium'].filter((k) => by[k]).map((k) => (
          <span key={k} className={`px-2.5 py-1 rounded-lg border text-xs font-bold ${SEV[k].border} ${SEV[k].bg} ${SEV[k].text}`}>
            {by[k]} {SEV[k].label}
          </span>
        ))}
        <span className="px-2.5 py-1 rounded-lg border border-slate-600/40 bg-slate-700/20 text-xs font-bold text-slate-300 ml-auto">
          {d?.total || 0} no total
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {(d?.vulnerabilities || []).map((v, i) => {
          const s = SEV[v.severity] || SEV.medium;
          return (
            <div key={i} className={`rounded-lg border ${s.border} bg-[#0f151d] p-3`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bug className={`w-4 h-4 ${s.text}`} />
                  <span className="font-bold text-slate-100 text-sm">{v.label}</span>
                </div>
                <span className={`text-[10px] font-bold ${s.text}`}>{s.label}</span>
              </div>
              <div className="text-[11px] font-mono text-slate-500 mt-1">{v.cwe} · {v.endpoint}</div>
              <div className="text-xs text-slate-400 mt-1.5">{v.impact}</div>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

function ReportPanel({ onClose }) {
  const [d, setD] = useState(null);
  const [reveal, setReveal] = useState(false);
  useEffect(() => { evilDogService.getReport().then(setD).catch(() => {}); }, []);
  const s = d?.summary || {};
  const tiles = [
    { label: 'Clientes comprometidos', value: s.users_compromised || 0, icon: Users, c: 'text-cyan-400' },
    { label: 'Valor em risco', value: `R$ ${Number(s.accounts_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: Banknote, c: 'text-green-400' },
    { label: 'Senhas vazadas', value: s.passwords_leaked || 0, icon: KeyRound, c: 'text-red-400' },
    { label: 'Segredos', value: s.secrets_leaked || 0, icon: Lock, c: 'text-amber-400' },
    { label: 'PIX desviado', value: `R$ ${Number(s.pix_stolen_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: Droplets, c: 'text-red-400' },
    { label: 'Sistemas', value: s.systems_compromised || 0, icon: Server, c: 'text-orange-400' },
  ];
  const users = d?.users || [];
  return (
    <Shell title="REPORT · Relatório de comprometimento" icon={FileWarning} accent="#22c55e" onClose={onClose}>
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 mb-4 flex items-center gap-2 text-sm">
        <AlertTriangle className="w-4 h-4 text-red-400" />
        <span className="text-slate-200">Alvo <span className="font-mono text-red-300">{d?.target}</span> comprometido —
          <span className="text-red-400 font-bold"> {s.critical || 0} vulnerabilidades críticas</span>, base de clientes exposta.</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.label} className="rounded-lg border border-[#1e2733] bg-[#0b1017] p-3">
              <div className="flex items-center gap-2 text-[11px] text-slate-500 uppercase tracking-wider">
                <Icon className={`w-3.5 h-3.5 ${t.c}`} /> {t.label}
              </div>
              <div className={`text-2xl font-bold mt-1 tabular-nums ${t.c}`}>{t.value}</div>
            </div>
          );
        })}
      </div>

      {(d?.secrets || []).length > 0 && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
          <div className="text-[11px] uppercase tracking-widest text-red-400 mb-1">Credenciais / segredos</div>
          {d.secrets.map((sec, i) => (
            <div key={i} className="text-[13px] font-mono text-red-300 break-all">
              {Object.entries(sec).map(([k, v]) => `${k} = ${reveal ? v : mask(v)}`).join('  ')}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-bold text-slate-200">Base de clientes exfiltrada</div>
        <button onClick={() => setReveal((r) => !r)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200">
          <Lock className="w-3.5 h-3.5" /> {reveal ? 'mascarar' : 'revelar tudo'}
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-[#1e2733]">
        <table className="w-full text-[13px] min-w-[640px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-[#1e2733]">
              <th className="text-left px-3 py-2">Nome</th><th className="text-left px-3 py-2">CPF</th>
              <th className="text-left px-3 py-2">Senha</th><th className="text-left px-3 py-2">Saldo</th>
              <th className="text-left px-3 py-2">Banco</th><th className="text-left px-3 py-2">Chave PIX</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr><td colSpan="6" className="px-3 py-6 text-center text-slate-600">
                sem dados — rode a pipeline ou o SQLi para exfiltrar
              </td></tr>
            )}
            {users.map((u, i) => (
              <tr key={i} className="border-b border-[#131b25] last:border-0">
                <td className="px-3 py-2 text-slate-200">{u.nome}</td>
                <td className="px-3 py-2 font-mono text-slate-300">{reveal ? u.cpf : mask(u.cpf)}</td>
                <td className="px-3 py-2 font-mono text-red-400 font-bold">{reveal ? (u.senha || '—') : mask(u.senha, 2)}</td>
                <td className="px-3 py-2 font-mono text-green-400">{u.saldo}</td>
                <td className="px-3 py-2 text-slate-400">{u.banco}</td>
                <td className="px-3 py-2 font-mono text-cyan-300 text-xs">{reveal ? u.chave_pix : mask(u.chave_pix, 5)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {d?.case_study && (
        <div className="mt-5 space-y-3">
          <div className="text-[11px] uppercase tracking-widest text-amber-400">
            Casos reais — o mesmo ataque, fora do laboratório
          </div>
          {(Array.isArray(d.case_study) ? d.case_study : [d.case_study]).map((cs, i) => (
            <div key={i} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="text-[11px] uppercase tracking-widest text-amber-400 mb-2">
                {cs.technique}
              </div>
              <p className="text-sm text-slate-300 mb-2">{cs.summary}</p>
              <p className="text-sm text-slate-400">
                <span className="text-slate-200 font-semibold">Caso real:</span> {cs.real_case}
              </p>
              <p className="text-sm text-slate-400 mt-2">
                <span className="text-slate-200 font-semibold">Detecção:</span> {cs.detection}
              </p>
              {cs.reference && (
                <a href={cs.reference} target="_blank" rel="noopener noreferrer"
                   className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300">
                  <ExternalLink className="w-3.5 h-3.5" /> Ver reportagem
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

const PANELS = { SCAN: ScanPanel, DETECT: VulnPanel, REPORT: ReportPanel, TRANSFER: ReportPanel };

export default function NodeModal({ node, onClose }) {
  if (!node) return null;
  const Panel = PANELS[node];
  if (!Panel) return null;
  return <Panel onClose={onClose} />;
}
