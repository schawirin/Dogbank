import React, { useState } from 'react';
import { Skull, LayoutDashboard, GitBranch, Wifi, WifiOff } from 'lucide-react';
import useEvilDog from '../components/EvilDog/useEvilDog';
import ControlPanel from '../components/EvilDog/ControlPanel';
import AttackOrchestrator from '../components/EvilDog/AttackOrchestrator';
import '../components/EvilDog/EvilDog.css';

const TABS = [
  { id: 'control', label: 'Control Panel', icon: LayoutDashboard },
  { id: 'orchestrator', label: 'Attack Orchestrator', icon: GitBranch },
];

/**
 * EvilDog — in-app attack console (DogBank lab only).
 * Dark, self-contained page (the app has no dark theme layer). Fires real,
 * lab-scoped attacks via evildog-api and streams live telemetry over SSE.
 */
export default function EvilDogPage() {
  const [tab, setTab] = useState('control');
  const evd = useEvilDog();

  return (
    <div className="evd-root -mx-4 -my-4 md:-mx-8 md:-my-8 min-h-[calc(100vh-73px)] p-4 md:p-6">
      {/* top bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg border border-green-500/40 bg-green-500/10 flex items-center justify-center">
            <Skull className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-100 tracking-wide">EVIL<span className="text-green-400">DOG</span></h1>
              <span className="px-2 py-0.5 rounded border border-red-500/40 bg-red-500/10 text-red-400 text-[10px] font-bold tracking-wider">
                PEN-TEST MODE
              </span>
            </div>
            <div className="text-[11px] text-slate-500 tracking-wider">RECON_SUITE · lab only · dados sintéticos</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-1.5 text-xs ${evd.connected ? 'text-green-400' : 'text-slate-500'}`}>
            {evd.connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {evd.connected ? 'telemetry live' : 'offline'}
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-[#1e2733] bg-[#0f151d] p-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                  ${tab === id ? 'bg-green-500/15 text-green-400' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tab === 'control' ? <ControlPanel evd={evd} /> : <AttackOrchestrator evd={evd} />}

      <div className="mt-6 text-center text-[11px] text-slate-600">
        EvilDog opera apenas contra os serviços do laboratório DogBank · uso educacional / EBC
      </div>
    </div>
  );
}
