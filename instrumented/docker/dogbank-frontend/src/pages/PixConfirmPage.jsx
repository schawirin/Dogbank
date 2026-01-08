// src/pages/PixConfirmPage.jsx
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import pixService from '../services/pixService';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Alert from '../components/common/Alert';

const PixConfirmPage = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [counter, setCounter] = useState(null);
  const [error, setError] = useState('');

  if (!state) {
    return (
      <div className="py-6">
        <Alert type="error" message="Dados do PIX ausentes." />
        <div className="mt-4">
          <Button onClick={() => navigate('/dashboard/pix')}>
            Voltar para PIX
          </Button>
        </div>
      </div>
    );
  }

  // Garantir que amount seja número
  const rawAmount = state.amount;
  const amount = typeof rawAmount === 'string' ? parseFloat(rawAmount) : rawAmount;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setCounter(3);

    // Simula a latência de 3 segundos com contador
    for (let i = 3; i > 0; i--) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((res) => setTimeout(res, 1000));
      setCounter(i - 1);
    }
    setCounter(null);

    try {
      // Executa PIX (validação + confirmação)
      const receipt = await pixService.executePix({
        pixKey: state.pixKey,
        amount,
        description: state.description || '',
        password,
        sourceAccountId: state.sourceAccountId ?? user?.accountId ?? localStorage.getItem('accountId'),
      });

      // ✅ CORREÇÃO: Usar rota correta para o recibo
      navigate('/dashboard/pix/receipt', { state: receipt });
    } catch (err) {
      console.error('Erro na confirmação PIX:', err);
      const msg = err.response?.data?.error || err.message || 'Falha na confirmação.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="py-6">
      {/* Header moderno */}
      <div className="mb-8">
        <button 
          onClick={() => navigate('/dashboard/pix')}
          className="flex items-center text-primary-600 hover:text-primary-700 mb-4 transition-colors"
          disabled={loading}
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Voltar
        </button>
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">Confirmar PIX</h1>
        <p className="text-neutral-600">Revise os dados e confirme sua transferência</p>
      </div>

      {error && (
        <Alert type="error" message={error} className="mb-6" />
      )}

      {/* Loading Screen - Círculo simples */}
      {loading && (
        <div className="fixed inset-0 bg-white bg-opacity-95 flex flex-col items-center justify-center z-50">
          <div className="text-center max-w-sm">
            {/* Círculo de progresso */}
            <div className="mb-8">
              <div className="relative w-32 h-32 mx-auto">
                <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 128 128">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="rgb(229, 231, 235)"
                    strokeWidth="8"
                    fill="none"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="rgb(139, 92, 246)"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray="351.86"
                    strokeDashoffset={351.86 - (351.86 * (3 - (counter || 0))) / 3}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-linear"
                  />
                </svg>
                {/* Ícone central */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-4xl animate-pulse">💸</div>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-neutral-900">
                Processando seu PIX...
              </h3>
              <p className="text-neutral-600">
                Aguarde enquanto processamos sua transferência
              </p>
              {counter !== null && (
                <div className="flex items-center justify-center gap-2">
                  <div className="text-2xl font-bold text-primary-600">{counter}</div>
                  <span className="text-neutral-500">segundos</span>
                </div>
              )}
            </div>

            {/* Pontinhos de loading */}
            <div className="mt-6 flex justify-center gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 bg-primary-400 rounded-full animate-pulse"
                  style={{
                    animationDelay: `${i * 0.2}s`,
                    animationDuration: '1s'
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Resumo da transferência */}
      <div className="mb-8">
        <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">💸</span>
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">
              Resumo da transferência
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-neutral-600">Valor</p>
                <p className="text-3xl font-bold text-blue-600">
                  {formatCurrency(amount)}
                </p>
              </div>
              <div>
                <p className="text-sm text-neutral-600">Para</p>
                <p className="font-semibold text-neutral-900">
                  {state.receiverName || state.pixKey}
                </p>
                {state.receiverBank && (
                  <p className="text-sm text-neutral-500">{state.receiverBank}</p>
                )}
              </div>
              <div className="pt-2 border-t border-blue-200">
                <p className="text-sm text-neutral-600">Chave PIX</p>
                <p className="font-mono text-sm text-neutral-700 break-all">
                  {state.pixKey}
                </p>
              </div>
              {state.description && (
                <div>
                  <p className="text-sm text-neutral-600">Descrição</p>
                  <p className="text-sm text-neutral-700">{state.description}</p>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Campo de senha */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-lg font-semibold text-neutral-900 mb-3">
            Digite sua senha bancária
          </label>
          <div className="relative">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              className="w-full px-6 py-5 text-xl font-bold text-center border-2 border-neutral-200 rounded-2xl bg-white focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition-all duration-200 tracking-widest"
              required
              disabled={loading}
              maxLength={6}
            />
            {password && (
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 text-sm">✓</span>
                </div>
              </div>
            )}
          </div>
          <p className="text-sm text-neutral-500 mt-2 text-center">
            Sua senha de 6 dígitos para confirmar a transferência
          </p>
        </div>

        <div className="pt-4">
          <Button
            type="submit"
            disabled={loading || !password || password.length < 6}
            className="w-full py-5 text-xl font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <span className="mr-3">🐕</span>
                Processando...
              </div>
            ) : (
              'Confirmar PIX'
            )}
          </Button>
        </div>
      </form>

      {/* Informações de segurança */}
      <div className="mt-8">
        <Card className="p-4 bg-yellow-50 border-yellow-200">
          <div className="flex items-start gap-3">
            <div className="text-2xl">🔒</div>
            <div>
              <h4 className="font-semibold text-yellow-800 mb-1">
                Transferência segura
              </h4>
              <p className="text-sm text-yellow-700">
                Seus dados estão protegidos e a transferência é irreversível após confirmação.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PixConfirmPage;
