// src/components/common/PixErrorModal.jsx
import React from 'react';

/**
 * Cachorrinho triste minimalista SVG
 */
const SadDogIcon = () => (
  <svg viewBox="0 0 120 120" className="w-24 h-24 mx-auto">
    {/* Corpo/Cabeça do cachorro */}
    <ellipse cx="60" cy="65" rx="35" ry="30" fill="#E8D5B7" />
    
    {/* Orelhas caídas (tristes) */}
    <ellipse cx="30" cy="50" rx="12" ry="20" fill="#D4B896" transform="rotate(-15 30 50)" />
    <ellipse cx="90" cy="50" rx="12" ry="20" fill="#D4B896" transform="rotate(15 90 50)" />
    
    {/* Focinho */}
    <ellipse cx="60" cy="75" rx="15" ry="12" fill="#F5E6D3" />
    
    {/* Nariz */}
    <ellipse cx="60" cy="72" rx="6" ry="4" fill="#4A4A4A" />
    
    {/* Olhos tristes (olhando para baixo) */}
    <circle cx="45" cy="58" r="5" fill="#4A4A4A" />
    <circle cx="75" cy="58" r="5" fill="#4A4A4A" />
    
    {/* Sobrancelhas tristes (inclinadas para baixo) */}
    <line x1="38" y1="48" x2="50" y2="52" stroke="#4A4A4A" strokeWidth="2" strokeLinecap="round" />
    <line x1="82" y1="48" x2="70" y2="52" stroke="#4A4A4A" strokeWidth="2" strokeLinecap="round" />
    
    {/* Boca triste */}
    <path d="M 50 82 Q 60 78 70 82" stroke="#4A4A4A" strokeWidth="2" fill="none" strokeLinecap="round" />
    
    {/* Lágrima */}
    <ellipse cx="48" cy="66" rx="2" ry="3" fill="#87CEEB" opacity="0.7" />
  </svg>
);

/**
 * Modal de erro amigável para falhas no PIX
 * Mostra mensagem genérica para o usuário, mas loga detalhes no Datadog
 */
const PixErrorModal = ({ isOpen, onClose, onRetry, errorType = 'generic' }) => {
  if (!isOpen) return null;

  // Mensagens amigáveis baseadas no tipo de erro
  const errorMessages = {
    timeout: {
      title: 'Ops! Algo deu errado',
      subtitle: 'Estamos com dificuldades para processar sua transferência no momento.',
      description: 'Não se preocupe, nada foi cobrado. Tente novamente em alguns instantes.',
      showRetry: true,
    },
    limit: {
      title: 'Limite excedido',
      subtitle: 'O valor ultrapassa o limite permitido para esta transação.',
      description: 'Tente um valor menor ou entre em contato com o suporte.',
      showRetry: false,
    },
    balance: {
      title: 'Saldo insuficiente',
      subtitle: 'Você não possui saldo suficiente para esta transferência.',
      description: 'Confira seu saldo e tente novamente.',
      showRetry: false,
    },
    generic: {
      title: 'Não foi possível completar o PIX',
      subtitle: 'Algo inesperado aconteceu, mas nada foi cobrado.',
      description: 'Não se preocupe, confira seu saldo e tente novamente.',
      showRetry: true,
    },
  };

  const error = errorMessages[errorType] || errorMessages.generic;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50">
      {/* Modal */}
      <div className="bg-white w-full sm:w-96 sm:rounded-3xl rounded-t-3xl p-6 sm:p-8 shadow-2xl animate-slide-up">
        {/* Handle bar (mobile) */}
        <div className="flex justify-center mb-4 sm:hidden">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-gray-100"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        <div className="text-center pt-4">
          {/* Sad Dog Icon */}
          <div className="mb-6 animate-bounce-slow">
            <SadDogIcon />
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-gray-900 mb-2">
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
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white font-semibold rounded-2xl transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40"
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
        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-5px);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default PixErrorModal;
