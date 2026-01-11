// src/pages/PixConfirmPage.jsx
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import pixService from '../services/pixService';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import PixErrorModal from '../components/common/PixErrorModal';

const PixConfirmPage = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [counter, setCounter] = useState(null);
  
  // Estado do modal de erro
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorType, setErrorType] = useState('generic');

  if (!state) {
    return (
      <div className="py-6 text-center">
        <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-100 to-violet-100 rounded-full flex items-center justify-center">
          <svg className="w-10 h-10 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-neutral-900 mb-2">Dados do PIX ausentes</h2>
        <p className="text-neutral-600 mb-6">Volte e inicie uma nova transferência.</p>
        <Button onClick={() => navigate('/dashboard/pix')}>
          Voltar para PIX
        </Button>
      </div>
    );
  }

  // Garantir que amount seja número
  const rawAmount = state.amount;
  const amount = typeof rawAmount === 'string' ? parseFloat(rawAmount) : rawAmount;

  /**
   * Determina o tipo de erro para exibir no modal
   * Os detalhes técnicos são logados para o Datadog
   */
  const handleError = (err) => {
    // ========================================
    // LOG DETALHADO PARA DATADOG (APM + Logs)
    // ========================================
    const errorDetails = {
      timestamp: new Date().toISOString(),
      errorType: 'PIX_TRANSFER_ERROR',
      message: err.message,
      pixKey: state.pixKey,
      amount: amount,
      userId: user?.id || localStorage.getItem('userId'),
      accountId: state.sourceAccountId ?? user?.accountId ?? localStorage.getItem('accountId'),
      responseStatus: err.response?.status,
      responseData: err.response?.data,
      stack: err.stack,
    };

    // Log para console (será capturado pelo Datadog RUM/Logs)
    console.error('[PIX_ERROR] Falha na transferência PIX:', errorDetails);
    
    // Log estruturado adicional para facilitar busca no Datadog
    console.error('[DATADOG_TRACE]', JSON.stringify({
      dd: {
        service: 'dogbank-frontend',
        env: 'dogbank',
      },
      error: {
        kind: 'PIX_TRANSFER_FAILURE',
        message: err.message,
        stack: err.stack,
      },
      context: {
        pixKey: state.pixKey,
        amount: amount,
        timestamp: new Date().toISOString(),
      }
    }));

    // ========================================
    // DETERMINA TIPO DE ERRO PARA O MODAL
    // ========================================
    const msg = err.message || err.response?.data?.error || '';
    
    if (msg.includes('timeout') || msg.includes('Timeout') || msg.includes('não respondeu') || msg.includes('ECONNABORTED')) {
      setErrorType('timeout');
    } else if (msg.includes('Limite') || msg.includes('limit')) {
      setErrorType('limit');
    } else if (msg.includes('Saldo') || msg.includes('saldo') || msg.includes('balance')) {
      setErrorType('balance');
    } else {
      setErrorType('generic');
    }

    // Mostra o modal amigável
    setShowErrorModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
      // Executa PIX (validação no Banco Central + confirmação)
      // O timeout do Banco Central acontece AQUI!
      const receipt = await pixService.executePix({
        pixKey: state.pixKey,
        amount,
        description: state.description || '',
        password,
        sourceAccountId: state.sourceAccountId ?? user?.accountId ?? localStorage.getItem('accountId'),
      });

      // ✅ Sucesso - vai para o recibo
      navigate('/dashboard/pix/receipt', { state: receipt });
    } catch (err) {
      // Trata o erro com modal amigável + log detalhado
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setShowErrorModal(false);
    setPassword('');
  };

  const handleCloseModal = () => {
    setShowErrorModal(false);
    navigate('/dashboard');
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="py-6">
      {/* Modal de erro amigável */}
      <PixErrorModal
        isOpen={showErrorModal}
        onClose={handleCloseModal}
        onRetry={handleRetry}
        errorType={errorType}
      />

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

      {/* Loading Screen - Animação moderna */}
      {loading && (
        <div className="fixed inset-0 bg-gradient-to-br from-slate-50 to-purple-50 flex flex-col items-center justify-center z-50">
          <div className="text-center max-w-sm">
            {/* Animação de círculos pulsantes */}
            <div className="mb-8 relative">
              <div className="w-32 h-32 mx-auto relative">
                {/* Círculos animados */}
                <div className="absolute inset-0 rounded-full border-4 border-purple-200 animate-ping opacity-20"></div>
                <div className="absolute inset-2 rounded-full border-4 border-purple-300 animate-ping opacity-30" style={{ animationDelay: '0.2s' }}></div>
                <div className="absolute inset-4 rounded-full border-4 border-purple-400 animate-ping opacity-40" style={{ animationDelay: '0.4s' }}></div>
                
                {/* Círculo central com ícone */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-violet-600 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/30">
                    <svg className="w-10 h-10 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                </div>
                
                {/* Círculo de progresso */}
                <svg className="absolute inset-0 w-32 h-32 transform -rotate-90" viewBox="0 0 128 128">
                  <circle
                    cx="64"
                    cy="64"
                    r="60"
                    stroke="rgb(233, 213, 255)"
                    strokeWidth="4"
                    fill="none"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="60"
                    stroke="url(#gradient)"
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray="377"
                    strokeDashoffset={377 - (377 * (3 - (counter || 0))) / 3}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-linear"
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#7c3aed" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>
            
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-neutral-900">
                Processando seu PIX
              </h3>
              <p className="text-neutral-600">
                Conectando ao Banco Central...
              </p>
              {counter !== null && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent">
                    {counter}
                  </div>
                  <span className="text-neutral-500">segundos</span>
                </div>
              )}
            </div>

            {/* Indicador de etapas */}
            <div className="mt-8 flex justify-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-neutral-500">Validando</span>
              </div>
              <div className="w-8 h-px bg-neutral-300 self-center"></div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${counter && counter <= 2 ? 'bg-purple-500 animate-pulse' : 'bg-neutral-300'}`}></div>
                <span className="text-xs text-neutral-500">Processando</span>
              </div>
              <div className="w-8 h-px bg-neutral-300 self-center"></div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${counter && counter <= 1 ? 'bg-purple-500 animate-pulse' : 'bg-neutral-300'}`}></div>
                <span className="text-xs text-neutral-500">Finalizando</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resumo da transferência */}
      <div className="mb-8">
        <Card className="p-6 bg-gradient-to-br from-purple-50 via-violet-50 to-indigo-50 border border-purple-100">
          <div className="text-center">
            {/* Ícone moderno */}
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/20">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">
              Resumo da transferência
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-neutral-500 mb-1">Valor</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent">
                  {formatCurrency(amount)}
                </p>
              </div>
              <div className="pt-4 border-t border-purple-100">
                <p className="text-sm text-neutral-500 mb-1">Para</p>
                <p className="font-semibold text-neutral-900">
                  {state.receiverName || state.pixKey}
                </p>
                {state.receiverBank && (
                  <p className="text-sm text-neutral-500">{state.receiverBank}</p>
                )}
              </div>
              <div className="pt-4 border-t border-purple-100">
                <p className="text-sm text-neutral-500 mb-1">Chave PIX</p>
                <p className="font-mono text-sm text-neutral-700 break-all bg-white/50 px-3 py-2 rounded-lg">
                  {state.pixKey}
                </p>
              </div>
              {state.description && (
                <div className="pt-4 border-t border-purple-100">
                  <p className="text-sm text-neutral-500 mb-1">Descrição</p>
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
              className="w-full px-6 py-5 text-xl font-bold text-center border-2 border-neutral-200 rounded-2xl bg-white focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all duration-200 tracking-widest"
              required
              disabled={loading}
              maxLength={6}
            />
            {password && password.length === 6 && (
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
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
            className="w-full py-5 text-xl font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
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
        <Card className="p-4 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-amber-800 mb-1">
                Transferência segura
              </h4>
              <p className="text-sm text-amber-700">
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
