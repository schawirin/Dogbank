// src/pages/PixReceiptPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import Button from '../components/common/Button';
import pixService from '../services/pixService';
import { useAuth } from '../hooks/useAuth';

const PixReceiptPage = () => {
  const location = useLocation();
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const receiptRef = useRef(null);

  const initialDetails = location.state && location.state.transactionId && location.state.authCode
    ? location.state
    : null;
  const [details, setDetails] = useState(initialDetails);
  const [loading, setLoading] = useState(!initialDetails);
  const [error, setError] = useState('');
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    if (!details && transactionId) {
      setLoading(true);
      pixService.getReceiptDetails(transactionId)
        .then(setDetails)
        .catch(() => setError('Recibo não encontrado.'))
        .finally(() => setLoading(false));
    }
    
    // Hide confetti after 3 seconds
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, [details, transactionId]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (iso) => {
    const date = new Date(iso);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatTime = (iso) => {
    const date = new Date(iso);
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatCPF = (cpf) => {
    if (!cpf) return '***.***.***-**';
    const cleaned = cpf.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return cpf;
  };

  const handleShare = () => {
    const text = `Comprovante PIX DogBank\nValor: ${formatCurrency(Number(details.amount))}\nPara: ${details.receiverName || details.pixKeyDestination}\nData: ${formatDate(details.completedAt)} às ${formatTime(details.completedAt)}\nCódigo: ${details.authCode}`;
    if (navigator.share) {
      navigator.share({ 
        title: 'Comprovante PIX - DogBank', 
        text,
      });
    } else {
      navigator.clipboard.writeText(text);
      alert('Comprovante copiado para a área de transferência!');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4" />
          <p className="text-slate-600">Carregando comprovante...</p>
        </div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="py-6">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">
            Comprovante não encontrado
          </h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <Button onClick={() => navigate('/dashboard')}>
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const d = details;
  const senderName = d.senderName || user?.nome || 'Remetente';
  const senderCpf = user?.cpf || localStorage.getItem('cpf') || '';

  return (
    <div className="py-6 max-w-2xl mx-auto relative">
      {/* Confetti Animation */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-20px',
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            >
              <div 
                className="w-3 h-3 rounded-sm"
                style={{
                  backgroundColor: ['#22c55e', '#16a34a', '#4ade80', '#86efac', '#a855f7', '#7c3aed'][Math.floor(Math.random() * 6)],
                  transform: `rotate(${Math.random() * 360}deg)`,
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Success Header - PIX Concluído */}
      <div className="mb-6 print:hidden">
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg shadow-green-500/30 relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
          </div>
          
          <div className="relative flex items-center gap-4">
            {/* Animated checkmark */}
            <div className="relative">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center animate-scale-in">
                  <svg className="w-7 h-7 text-green-600 animate-check-draw" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={3} 
                      d="M5 13l4 4L19 7"
                      className="animate-check-path"
                    />
                  </svg>
                </div>
              </div>
              {/* Pulse rings */}
              <div className="absolute inset-0 rounded-full border-2 border-white/30 animate-ping"></div>
              <div className="absolute inset-0 rounded-full border-2 border-white/20 animate-ping" style={{ animationDelay: '0.5s' }}></div>
            </div>
            
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-1">PIX Concluído!</h2>
              <p className="text-green-100 text-sm">
                Sua transferência foi realizada com sucesso
              </p>
            </div>
            
            {/* Amount badge */}
            <div className="text-right">
              <p className="text-green-100 text-xs mb-1">Valor transferido</p>
              <p className="text-2xl font-bold">{formatCurrency(Number(d.amount))}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Comprovante estilo Stone */}
      <div 
        ref={receiptRef}
        className="bg-white rounded-2xl shadow-xl overflow-hidden print:shadow-none border border-slate-100"
      >
        {/* Header com Logo */}
        <div className="bg-gradient-to-r from-purple-600 to-violet-600 px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-white text-2xl font-bold">DogBank</span>
            </div>
            <div className="text-right">
              <p className="text-purple-200 text-xs">Comprovante</p>
              <p className="text-white font-semibold">PIX</p>
            </div>
          </div>
        </div>

        {/* Conteúdo do Comprovante */}
        <div className="px-8 py-6">
          {/* Título e Data */}
          <div className="border-b border-slate-100 pb-4 mb-6">
            <h1 className="text-xl font-bold text-slate-900 mb-1">
              Comprovante de Transferência
            </h1>
            <p className="text-slate-500 text-sm">
              {formatDate(d.completedAt)} às {formatTime(d.completedAt)}
            </p>
          </div>

          {/* Valor - Destacado */}
          <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100">
            <p className="text-sm text-green-700 mb-1 font-medium">Valor da transferência</p>
            <p className="text-4xl font-bold text-green-600">
              {formatCurrency(Number(d.amount))}
            </p>
          </div>

          {/* CONTA ORIGEM */}
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <div className="w-1 h-4 bg-purple-500 rounded-full"></div>
              Conta Origem
            </h2>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-slate-400 mb-1">De</p>
                <p className="text-sm font-semibold text-slate-900">{senderName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Documento</p>
                <p className="text-sm font-medium text-slate-700">{formatCPF(senderCpf)}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 p-3 bg-slate-50 rounded-lg">
              <div>
                <p className="text-xs text-slate-400 mb-1">Banco</p>
                <p className="text-sm font-medium text-slate-700">999 - DogBank S.A.</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Agência</p>
                <p className="text-sm font-medium text-slate-700">{d.senderAgency || '0001'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Conta</p>
                <p className="text-sm font-medium text-slate-700">{d.senderAccount || '******-*'}</p>
              </div>
            </div>
          </div>

          {/* Arrow indicator */}
          <div className="flex justify-center my-4">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          </div>

          {/* CONTA DESTINO */}
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <div className="w-1 h-4 bg-green-500 rounded-full"></div>
              Conta Destino
            </h2>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-slate-400 mb-1">Para</p>
                <p className="text-sm font-semibold text-slate-900">
                  {d.receiverName || d.pixKeyDestination}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Documento</p>
                <p className="text-sm font-medium text-slate-700">
                  {d.receiverDocument ? formatCPF(d.receiverDocument) : '***.***.***-**'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 p-3 bg-slate-50 rounded-lg">
              <div>
                <p className="text-xs text-slate-400 mb-1">Banco</p>
                <p className="text-sm font-medium text-slate-700">
                  {d.receiverBank || '999 - DogBank S.A.'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Agência</p>
                <p className="text-sm font-medium text-slate-700">{d.receiverAgency || '0001'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Conta</p>
                <p className="text-sm font-medium text-slate-700">{d.receiverAccount || '******-*'}</p>
              </div>
            </div>
          </div>

          {/* Linha divisória */}
          <div className="border-t border-slate-100 my-6"></div>

          {/* INFORMAÇÕES DA TRANSFERÊNCIA */}
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <div className="w-1 h-4 bg-slate-400 rounded-full"></div>
              Informações da Transferência
            </h2>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-slate-50">
                <span className="text-sm text-slate-500">Tipo</span>
                <span className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  PIX
                </span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-slate-50">
                <span className="text-sm text-slate-500">Chave PIX</span>
                <span className="text-sm font-medium text-slate-700 break-all text-right max-w-[60%]">
                  {d.pixKeyDestination}
                </span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-slate-50">
                <span className="text-sm text-slate-500">Código de Autenticação</span>
                <span className="text-sm font-mono font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded">
                  {d.authCode}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-slate-50">
                <span className="text-sm text-slate-500">ID da Transação</span>
                <span className="text-sm font-mono font-medium text-slate-700">
                  {d.transactionId}
                </span>
              </div>

              {d.description && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-slate-500">Descrição</span>
                  <span className="text-sm font-medium text-slate-700">{d.description}</span>
                </div>
              )}
            </div>
          </div>

          {/* Rodapé do comprovante */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="text-sm text-slate-500">
              <p className="font-semibold text-slate-700">DogBank S.A.</p>
              <p className="text-xs">CNPJ: 00.000.000/0001-00</p>
            </div>
            <div className="text-right text-xs text-slate-400">
              <p>Documento gerado em</p>
              <p>{new Date().toLocaleString('pt-BR')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Ações (não aparecem na impressão) */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 print:hidden">
        <Button 
          onClick={() => navigate('/dashboard/pix')}
          className="py-4 text-base font-semibold rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 shadow-lg shadow-purple-500/20"
        >
          Fazer outro PIX
        </Button>
        <Button 
          variant="secondary" 
          onClick={handleShare}
          className="py-4 text-base font-medium rounded-xl flex items-center justify-center gap-2 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
          </svg>
          Compartilhar
        </Button>
        <Button 
          variant="secondary" 
          onClick={handlePrint}
          className="py-4 text-base font-medium rounded-xl flex items-center justify-center gap-2 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Imprimir
        </Button>
      </div>

      {/* Botão voltar */}
      <div className="mt-6 text-center print:hidden">
        <button 
          onClick={() => navigate('/dashboard')}
          className="text-slate-500 hover:text-slate-700 flex items-center gap-2 transition-colors mx-auto"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Voltar ao Dashboard
        </button>
      </div>

      {/* Custom CSS for animations */}
      <style>{`
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        
        @keyframes scale-in {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        @keyframes check-draw {
          0% {
            stroke-dasharray: 0 100;
          }
          100% {
            stroke-dasharray: 100 0;
          }
        }
        
        .animate-confetti {
          animation: confetti linear forwards;
        }
        
        .animate-scale-in {
          animation: scale-in 0.5s ease-out forwards;
        }
        
        .animate-check-path {
          stroke-dasharray: 100;
          stroke-dashoffset: 100;
          animation: check-draw 0.5s ease-out 0.3s forwards;
        }
        
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:shadow-none,
          .print\\:shadow-none * {
            visibility: visible;
          }
          .print\\:shadow-none {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            box-shadow: none !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default PixReceiptPage;
