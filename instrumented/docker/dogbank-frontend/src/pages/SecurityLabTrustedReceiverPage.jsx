import React, { useEffect, useRef, useState } from 'react';
import { isTrustedLabMessage, POSTMESSAGE_LAB_EVENT } from '../securityLab/postMessageLab';

export default function SecurityLabTrustedReceiverPage() {
  const frameRef = useRef(null);
  const [accepted, setAccepted] = useState([]);
  const [rejected, setRejected] = useState(0);

  useEffect(() => {
    const receive = (event) => {
      if (isTrustedLabMessage(event, {
        allowedOrigin: window.location.origin,
        expectedSource: frameRef.current?.contentWindow,
      }) && event.data.type === POSTMESSAGE_LAB_EVENT) {
        setAccepted((items) => [...items, event.data]);
      } else if (event.data?.type === POSTMESSAGE_LAB_EVENT) {
        setRejected((count) => count + 1);
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-green-400">Security Lab · legitimate receiver</p>
        <h1 className="mt-2 text-3xl font-black">Receptor corrigido</h1>
        <p className="mt-2 text-slate-400">A página valida <code>event.origin</code> e <code>event.source</code> antes de aceitar o evento sintético.</p>
        <div className="mt-5 grid gap-4 lg:grid-cols-[2fr,1fr]">
          <iframe ref={frameRef} title="DogBank fixed PIX lab" src="/security-lab/pix-demo?mode=fixed" className="h-[650px] w-full rounded-xl border border-slate-700 bg-white" />
          <aside className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-green-400">Accepted: {accepted.length}</div>
            <div className="mt-1 text-red-400">Rejected: {rejected}</div>
            <pre className="mt-4 overflow-auto whitespace-pre-wrap text-xs text-slate-300">{accepted.length ? JSON.stringify(accepted.at(-1), null, 2) : 'Aguardando PIX fictício…'}</pre>
          </aside>
        </div>
      </div>
    </main>
  );
}
