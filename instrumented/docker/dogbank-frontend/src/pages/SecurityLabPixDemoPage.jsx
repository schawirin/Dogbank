import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, LockKeyhole, ShieldCheck, Zap } from 'lucide-react';
import PixStepIndicator from '../components/pix/PixStepIndicator';
import {
  POSTMESSAGE_LAB_PING,
  POSTMESSAGE_LAB_READY,
  SYNTHETIC_PIX,
  labModeFrom,
  sendSyntheticPixMessage,
  targetOriginFor,
} from '../securityLab/postMessageLab';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function SecurityLabPixDemoPage() {
  const mode = useMemo(() => labModeFrom(), []);
  const vulnerable = mode === 'vulnerable';
  const autoplay = useMemo(() => new URLSearchParams(window.location.search).get('autoplay') === '1', []);
  const timers = useRef([]);
  const phaseRef = useRef('review');
  const [phase, setPhase] = useState('review');
  const [sent, setSent] = useState(null);

  const later = useCallback((callback, delay) => {
    const timer = window.setTimeout(callback, delay);
    timers.current.push(timer);
    return timer;
  }, []);

  const completePix = useCallback(() => {
    if (phaseRef.current !== 'review') return;
    phaseRef.current = 'processing';
    setPhase('processing');
    later(() => {
      const result = sendSyntheticPixMessage({ mode });
      setSent(result);
      phaseRef.current = 'complete';
      setPhase('complete');
    }, 1800);
  }, [later, mode]);

  useEffect(() => {
    const receivePing = (event) => {
      if (event.data?.type !== POSTMESSAGE_LAB_PING) return;
      if (!vulnerable && event.origin !== window.location.origin) return;
      event.source?.postMessage(
        { type: POSTMESSAGE_LAB_READY, lab: { synthetic: true }, mode },
        vulnerable ? '*' : window.location.origin,
      );
    };
    window.addEventListener('message', receivePing);
    return () => window.removeEventListener('message', receivePing);
  }, [mode, vulnerable]);

  useEffect(() => {
    if (!autoplay) return undefined;
    const timer = later(completePix, 950);
    return () => window.clearTimeout(timer);
  }, [autoplay, completePix, later]);

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  return (
    <main className="min-h-screen bg-slate-100 p-3 text-slate-900 sm:p-4">
      <div className="mx-auto max-w-2xl">
        <div className="mb-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600 text-white"><Zap className="h-4 w-4" /></div>
            <div><strong className="text-sm text-slate-900">DogBank PIX</strong><p className="text-[10px] text-slate-500">Jornada real do app · operação de laboratório</p></div>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[9px] font-black tracking-wider ${vulnerable ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
            {vulnerable ? 'VULNERABLE MODE' : 'FIXED MODE'}
          </span>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          {phase === 'complete' ? (
            <div className="animate-slide-up">
              <header className="bg-gradient-to-r from-emerald-500 to-green-600 px-5 py-4 text-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20"><Check className="h-6 w-6" /></div>
                  <div className="flex-1"><h1 className="text-xl font-black">PIX concluído!</h1><p className="text-xs text-emerald-50">A transferência fictícia foi processada com sucesso</p></div>
                  <div className="text-right"><p className="text-[10px] text-emerald-100">Valor transferido</p><strong className="text-xl">{money.format(SYNTHETIC_PIX.amount)}</strong></div>
                </div>
              </header>
              <div className="p-5">
                <PixStepIndicator current={3} />
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-3"><div><p className="text-[10px] uppercase tracking-wider text-slate-400">Comprovante DogBank</p><strong className="text-sm">Transferência PIX</strong></div><code className="text-xs font-bold text-purple-600">{SYNTHETIC_PIX.transactionId}</code></div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-xs text-slate-400">De</span><p className="font-bold">{SYNTHETIC_PIX.payerName}</p><code className="text-xs text-slate-500">{SYNTHETIC_PIX.payerCpf}</code></div>
                    <div><span className="text-xs text-slate-400">Para</span><p className="font-bold">{SYNTHETIC_PIX.receiverName}</p><code className="text-xs text-slate-500">{SYNTHETIC_PIX.receiverCpf}</code></div>
                  </div>
                </div>
                <div role="status" className={`mt-3 rounded-lg border px-3 py-2 text-xs ${vulnerable ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                  Evento <strong>PIX_COMPLETED</strong> emitido para <code className="font-bold">{sent?.targetOrigin}</code>.
                </div>
              </div>
            </div>
          ) : (
            <div>
              <header className="border-b border-slate-100 px-5 py-3">
                <div className="flex items-center gap-3"><button type="button" aria-label="Voltar" className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-400"><ChevronLeft className="h-4 w-4" /></button><div><h1 className="text-lg font-black">Confirmar PIX</h1><p className="text-xs text-slate-500">Revise os dados e confirme sua transferência</p></div></div>
              </header>
              <div className="relative p-5">
                <PixStepIndicator current={2} />
                <div className="grid gap-4 sm:grid-cols-[.9fr_1.1fr]">
                  <div className="rounded-xl border border-purple-100 bg-gradient-to-br from-purple-50 to-indigo-50 p-4 text-center">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-white"><Zap className="h-5 w-5" /></div>
                    <p className="text-xs text-slate-500">Valor da transferência</p><strong className="mt-1 block text-2xl text-purple-700">{money.format(SYNTHETIC_PIX.amount)}</strong>
                    <div className="mt-3 border-t border-purple-100 pt-3 text-left"><span className="text-[10px] text-slate-400">Para</span><p className="text-sm font-bold">{SYNTHETIC_PIX.receiverName}</p><code className="text-[10px] text-slate-500">{SYNTHETIC_PIX.receiverCpf}</code></div>
                  </div>
                  <div className="flex flex-col justify-center">
                    <label className="mb-2 text-xs font-bold text-slate-700">Senha bancária</label>
                    <div className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white"><LockKeyhole className="mr-1 h-4 w-4 text-slate-400" />{[0, 1, 2, 3, 4, 5].map((item) => <i key={item} className="h-2.5 w-2.5 rounded-full bg-slate-800" />)}</div>
                    <button type="button" onClick={completePix} disabled={phase !== 'review'} className="mt-3 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-purple-500/20 disabled:opacity-60">Confirmar PIX</button>
                    <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-500" /> Ambiente DogBank controlado e sem movimentação real</div>
                  </div>
                </div>

                {phase === 'processing' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/95 backdrop-blur-sm">
                    <div className="text-center">
                      <div className="relative mx-auto mb-4 h-16 w-16"><div className="absolute inset-0 animate-ping rounded-full border-4 border-purple-300 opacity-30" /><div className="absolute inset-2 flex items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-violet-600 text-white shadow-lg"><Zap className="h-6 w-6 animate-pulse" /></div></div>
                      <h2 className="text-lg font-black">Processando seu PIX</h2><p className="mt-1 text-xs text-slate-500">Validando · Processando · Finalizando</p>
                      <div className="mx-auto mt-3 h-1.5 w-44 overflow-hidden rounded-full bg-slate-200"><div className="security-lab-progress h-full rounded-full bg-purple-600" /></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <p className="mt-2 text-center text-[10px] text-slate-500">
          LAB CONTROLADO · dados fictícios · <code>{vulnerable ? 'frame-ancestors *' : "frame-ancestors 'self'"}</code> · destino <code>{targetOriginFor(mode)}</code>
        </p>
      </div>
    </main>
  );
}
