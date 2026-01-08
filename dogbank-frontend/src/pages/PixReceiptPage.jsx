// src/pages/PixReceiptPage.jsx
import React, { useState, useEffect } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import Button from '../components/common/Button';
import pixService from '../services/pixService';

const formatDate = (iso) =>
  new Date(iso).toLocaleString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const PixReceiptPage = () => {
  const location = useLocation();
  const { transactionId } = useParams();
  const navigate = useNavigate();

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

  const handleShare = () => {
    const text = `Comprovante PIX - ${formatCurrency(Number(details.amount))} para ${details.receiverName || details.pixKeyDestination}`;
    if (navigator.share) {
      navigator.share({ 
        title: 'Comprovante PIX', 
        text,
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(text);
      alert('Comprovante copiado para a área de transferência!');
    }
  };

  const handleDownload = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4" />
          <p className="text-neutral-600">Carregando comprovante...</p>
        </div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="py-6">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-xl font-semibold text-neutral-800 mb-2">
            Comprovante não encontrado
          </h2>
          <p className="text-neutral-600 mb-6">{error}</p>
          <Button onClick={() => navigate('/dashboard')}>
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const d = details;

  return (
    <div className="py-6">
      {/* Header moderno */}
      <div className="mb-8">
        <button 
          onClick={() => navigate('/dashboard')}
          className="flex items-center text-primary-600 hover:text-primary-700 mb-4 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Voltar ao Início
        </button>
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">PIX Realizado</h1>
        <p className="text-neutral-600">Sua transferência foi concluída com sucesso</p>
      </div>

      {/* Card de sucesso */}
      <div className="mb-8">
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-3xl p-8 text-white text-center shadow-lg">
          <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2">PIX realizado!</h2>
          <p className="text-green-100">Transferência processada com sucesso</p>
        </div>
      </div>

      {/* Detalhes da transferência */}
      <div className="space-y-6">
        {/* Valor */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-100">
          <div className="text-center">
            <p className="text-sm font-medium text-neutral-600 mb-2">Valor transferido</p>
            <p className="text-4xl font-bold text-neutral-900">
              {formatCurrency(Number(d.amount))}
            </p>
          </div>
        </div>

        {/* Destinatário */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-primary-600 font-semibold text-lg">
                {(d.receiverName || d.pixKeyDestination).charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-neutral-600">Para</p>
              <p className="text-lg font-semibold text-neutral-900">
                {d.receiverName || d.pixKeyDestination}
              </p>
              {d.receiverBank && (
                <p className="text-sm text-neutral-500">{d.receiverBank}</p>
              )}
            </div>
          </div>
        </div>

        {/* Data e hora */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-neutral-600 mb-2">Data e hora</p>
              <p className="text-lg font-semibold text-neutral-900">
                {formatDate(d.completedAt)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-600 mb-2">Status</p>
              <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                Concluído
              </div>
            </div>
          </div>
        </div>

        {/* Chave PIX */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-100">
          <p className="text-sm font-medium text-neutral-600 mb-2">Chave PIX</p>
          <p className="text-lg font-mono text-neutral-900 break-all bg-neutral-50 p-3 rounded-lg">
            {d.pixKeyDestination}
          </p>
        </div>

        {/* Códigos de identificação */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-100">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">
            Identificação da transação
          </h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-neutral-600 mb-2">
                Código de autenticação
              </p>
              <div className="flex items-center justify-between bg-neutral-50 p-3 rounded-lg">
                <p className="font-mono text-sm text-neutral-700 break-all">
                  {d.authCode}
                </p>
                <button
                  onClick={() => navigator.clipboard.writeText(d.authCode)}
                  className="ml-3 p-2 text-neutral-500 hover:text-primary-600 transition-colors"
                  title="Copiar código"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-600 mb-2">
                ID da transação
              </p>
              <div className="flex items-center justify-between bg-neutral-50 p-3 rounded-lg">
                <p className="font-mono text-sm text-neutral-700 break-all">
                  {d.transactionId}
                </p>
                <button
                  onClick={() => navigator.clipboard.writeText(d.transactionId)}
                  className="ml-3 p-2 text-neutral-500 hover:text-primary-600 transition-colors"
                  title="Copiar ID"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Conta de origem */}
        {d.senderName && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-100">
            <p className="text-sm font-medium text-neutral-600 mb-3">Conta de origem</p>
            <div className="space-y-2">
              <p className="font-semibold text-neutral-900">{d.senderName}</p>
              <p className="text-sm text-neutral-600">
                Banco {d.senderBankCode} • Agência {d.senderAgency} • Conta {d.senderAccount}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Ações */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-3">
        <Button 
          onClick={() => navigate('/dashboard/pix')}
          className="py-3 text-base font-medium rounded-xl"
        >
          Fazer outro PIX
        </Button>
        <Button 
          variant="secondary" 
          onClick={handleShare}
          className="py-3 text-base font-medium rounded-xl"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
          </svg>
          Compartilhar
        </Button>
        <Button 
          variant="secondary" 
          onClick={handleDownload}
          className="py-3 text-base font-medium rounded-xl"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Baixar PDF
        </Button>
      </div>

      {/* Informações adicionais */}
      <div className="mt-8">
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
              <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-blue-900 mb-2">
                Guarde este comprovante
              </h4>
              <p className="text-sm text-blue-700">
                Este comprovante é sua garantia de que a transferência foi realizada. 
                Você pode usar os códigos de identificação para consultas futuras.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PixReceiptPage;
