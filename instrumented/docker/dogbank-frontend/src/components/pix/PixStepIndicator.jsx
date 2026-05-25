import React from 'react';
import { Check } from 'lucide-react';

const STEPS = [
  { id: 1, label: 'Destinatário' },
  { id: 2, label: 'Valor' },
  { id: 3, label: 'Comprovante' },
];

/**
 * Indicador visual de progresso do fluxo PIX (3 passos).
 *
 * Props:
 *  - current: 1 | 2 | 3 (step ativo)
 */
const PixStepIndicator = ({ current = 1 }) => {
  return (
    <div className="flex items-center justify-center gap-3 mb-6">
      {STEPS.map((step, idx) => {
        const isActive = current === step.id;
        const isCompleted = current > step.id;
        return (
          <React.Fragment key={step.id}>
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  isCompleted
                    ? 'bg-purple-600 text-white'
                    : isActive
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-500/40 scale-110'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : step.id}
              </div>
              <span
                className={`text-xs font-medium hidden sm:inline ${
                  isActive ? 'text-purple-700' : isCompleted ? 'text-slate-700' : 'text-slate-400'
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`w-8 sm:w-12 h-0.5 rounded-full transition-colors ${
                  isCompleted ? 'bg-purple-600' : 'bg-slate-200'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default PixStepIndicator;
