// src/components/common/PixErrorModal.jsx
import React from 'react';

/**
 * Modal de erro amigável para falhas no PIX
 * Mostra mensagem genérica para o usuário, mas loga detalhes no Datadog
 */
const PixErrorModal = ({ isOpen, onClose, onRetry, errorType = 'generic' }) => {
  if (!isOpen) return null;

  // Mensagens amigáveis baseadas no tipo de erro
  const errorMessages = {
    timeout: {
      title: 'O PIX não está funcionando como esperado',
      subtitle: 'Estamos com dificuldades para processar sua transferência no momento.',
      description: 'Não se preocupe, nada foi cobrado. Tente novamente em alguns instantes.',
      icon: '⏱️',
      showRetry: true,
    },
    limit: {
      title: 'Limite de transferência excedido',
      subtitle: 'O valor ultrapassa o limite permitido para esta transação.',
      description: 'Tente um valor menor ou entre em contato com o suporte.',
      icon: '🚫',
      showRetry: false,
    },
    balance: {
      title: 'Saldo insuficiente',
      subtitle: 'Você não possui saldo suficiente para esta transferência.',
      description: 'Confira seu saldo e tente novamente.',
      icon: '💰',
      showRetry: false,
    },
    generic: {
      title: 'Erro ao efetuar o PIX',
      subtitle: 'Não foi possível efetuar o PIX, nada foi cobrado.',
      description: 'Não se preocupe, confira seu saldo e tente novamente.',
      icon: '❌',
      showRetry: true,
    },
  };

  const error = errorMessages[errorType] || errorMessages.generic;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
      {/* Modal */}
      <div className="bg-white w-full sm:w-96 sm:rounded-2xl rounded-t-3xl p-6 sm:p-8 animate-slide-up">
        {/* Handle bar (mobile) */}
        <div className="flex justify-center mb-4 sm:hidden">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 sm:top-6 sm:left-6 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        <div className="text-center pt-8">
          {/* Icon */}
          <div className="text-6xl mb-6">{error.icon}</div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            {error.title}
          </h2>

          {/* Subtitle */}
          <p className="text-gray-600 mb-2">
            {error.subtitle}
          </p>

          {/* Description */}
          <p className="text-gray-500 text-sm mb-8">
            {error.description}
          </p>

          {/* Buttons */}
          <div className="space-y-3">
            {error.showRetry && (
              <button
                onClick={onRetry}
                className="w-full py-4 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-2xl transition-colors"
              >
                Tentar novamente
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-2xl transition-colors"
            >
              {error.showRetry ? 'Voltar ao início' : 'Ok, entendi'}
            </button>
          </div>
        </div>
      </div>

      {/* Animation styles */}
      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default PixErrorModal;
