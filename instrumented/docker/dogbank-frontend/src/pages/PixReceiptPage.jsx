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

  useEffect(() => {
    if (!details && transactionId) {
      setLoading(true);
      pixService.getReceiptDetails(transactionId)
        .then(setDetails)
        .catch(() => setError('Recibo não encontrado.'))
        .finally(() => setLoading(false));
    }
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
          <div className="text-6xl mb-4">❌</div>
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
    <div className="py-6 max-w-2xl mx-auto">
      {/* Comprovante estilo Stone */}
      <div 
        ref={receiptRef}
        className="bg-white rounded-lg shadow-lg overflow-hidden print:shadow-none"
      >
        {/* Header com Logo */}
        <div className="bg-purple-600 px-8 py-6">
          <div className="flex items-center gap-2">
            <span className="text-white text-2xl font-bold">DogBank</span>
            <span className="text-yellow-400 text-2xl">🐕</span>
          </div>
        </div>

        {/* Conteúdo do Comprovante */}
        <div className="px-8 py-6">
          {/* Título */}
          <div className="border-b border-slate-200 pb-4 mb-6">
            <h1 className="text-2xl font-bold text-slate-900">
              Comprovante de Transferência
            </h1>
            <p className="text-slate-500 mt-1">
              Realizada no dia {formatDate(d.completedAt)} às {formatTime(d.completedAt)}
            </p>
          </div>

          {/* Valor */}
          <div className="mb-6">
            <p className="text-sm text-slate-500 mb-1">Valor</p>
            <p className="text-3xl font-bold text-green-600">
              {formatCurrency(Number(d.amount))}
            </p>
          </div>

          {/* Linha divisória */}
          <div className="border-t border-slate-200 my-6"></div>

          {/* CONTA ORIGEM */}
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">
              Conta Origem
            </h2>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">De</p>
                <p className="text-sm font-medium text-slate-900">{senderName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Documento</p>
                <p className="text-sm font-medium text-slate-900">{formatCPF(senderCpf)}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Banco</p>
                <p className="text-sm font-medium text-slate-900">999 - DogBank S.A.</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Agência</p>
                <p className="text-sm font-medium text-slate-900">{d.senderAgency || '0001'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Conta</p>
                <p className="text-sm font-medium text-slate-900">{d.senderAccount || '******-*'}</p>
              </div>
            </div>
          </div>

          {/* Linha divisória */}
          <div className="border-t border-slate-200 my-6"></div>

          {/* CONTA DESTINO */}
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">
              Conta Destino
            </h2>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Para</p>
                <p className="text-sm font-medium text-slate-900">
                  {d.receiverName || d.pixKeyDestination}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Documento</p>
                <p className="text-sm font-medium text-slate-900">
                  {d.receiverDocument ? formatCPF(d.receiverDocument) : '***.***.***-**'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Banco</p>
                <p className="text-sm font-medium text-slate-900">
                  {d.receiverBank || '999 - DogBank S.A.'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Agência</p>
                <p className="text-sm font-medium text-slate-900">{d.receiverAgency || '0001'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Conta</p>
                <p className="text-sm font-medium text-slate-900">{d.receiverAccount || '******-*'}</p>
              </div>
            </div>
          </div>

          {/* Linha divisória */}
          <div className="border-t border-slate-200 my-6"></div>

          {/* INFORMAÇÕES DA TRANSFERÊNCIA */}
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">
              Informações da Transferência
            </h2>
            
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500 mb-1">Tipo</p>
                <p className="text-sm font-medium text-slate-900">PIX</p>
              </div>
              
              <div>
                <p className="text-xs text-slate-500 mb-1">Chave PIX</p>
                <p className="text-sm font-medium text-slate-900 break-all">
                  {d.pixKeyDestination}
                </p>
              </div>
              
              <div>
                <p className="text-xs text-slate-500 mb-1">Código de Autenticação</p>
                <p className="text-sm font-mono font-medium text-slate-900 break-all">
                  {d.authCode}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-1">ID da Transação</p>
                <p className="text-sm font-mono font-medium text-slate-900">
                  {d.transactionId}
                </p>
              </div>

              {d.description && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Descrição</p>
                  <p className="text-sm font-medium text-slate-900">{d.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Linha divisória */}
          <div className="border-t border-slate-200 my-6"></div>

          {/* Rodapé do comprovante */}
          <div className="text-sm text-slate-500">
            <p className="font-semibold text-slate-700">DogBank S.A.</p>
            <p>CNPJ: 00.000.000/0001-00</p>
          </div>
        </div>
      </div>

      {/* Ações (não aparecem na impressão) */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 print:hidden">
        <Button 
          onClick={() => navigate('/dashboard/pix')}
          className="py-3 text-base font-medium rounded-xl bg-purple-600 hover:bg-purple-700"
        >
          Fazer outro PIX
        </Button>
        <Button 
          variant="secondary" 
          onClick={handleShare}
          className="py-3 text-base font-medium rounded-xl flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
          </svg>
          Compartilhar
        </Button>
        <Button 
          variant="secondary" 
          onClick={handlePrint}
          className="py-3 text-base font-medium rounded-xl flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Imprimir
        </Button>
      </div>

      {/* Botão voltar */}
      <div className="mt-4 print:hidden">
        <button 
          onClick={() => navigate('/dashboard')}
          className="text-slate-600 hover:text-slate-800 flex items-center gap-2 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Voltar ao Dashboard
        </button>
      </div>

      {/* Estilos de impressão */}
      <style>{`
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
