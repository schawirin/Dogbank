// src/components/common/PixErrorModal.jsx
import React from 'react';

/**
 * Cachorrinho estilo Datadog (Bits) - Versão triste
 * Minimalista, branco com contornos roxos
 */
const SadDogIcon = () => (
  <svg viewBox="0 0 100 100" className="w-20 h-20 mx-auto">
    {/* Corpo principal */}
    <g fill="none" stroke="#7C3AED" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Cabeça */}
      <ellipse cx="50" cy="45" rx="28" ry="25" fill="white" />
      
      {/* Orelha esquerda (caída - triste) */}
      <path d="M 25 35 Q 15 45 20 55" fill="white" />
      <ellipse cx="20" cy="45" rx="8" ry="12" fill="white" transform="rotate(20 20 45)" />
      
      {/* Orelha direita (caída - triste) */}
      <path d="M 75 35 Q 85 45 80 55" fill="white" />
      <ellipse cx="80" cy="45" rx="8" ry="12" fill="white" transform="rotate(-20 80 45)" />
      
      {/* Focinho */}
      <ellipse cx="50" cy="55" rx="12" ry="8" fill="white" />
      
      {/* Nariz */}
      <ellipse cx="50" cy="52" rx="5" ry="3.5" fill="#7C3AED" />
      
      {/* Olhos tristes (olhando para baixo) */}
      <circle cx="38" cy="40" r="4" fill="#7C3AED" />
      <circle cx="62" cy="40" r="4" fill="#7C3AED" />
      
      {/* Sobrancelhas tristes */}
      <path d="M 30 32 L 42 36" strokeWidth="2" />
      <path d="M 70 32 L 58 36" strokeWidth="2" />
      
      {/* Boca triste */}
      <path d="M 42 60 Q 50 56 58 60" strokeWidth="2" />
      
      {/* Lágrima */}
      <path d="M 40 48 Q 42 54 40 58" stroke="#60A5FA" strokeWidth="1.5" fill="none" />
      <circle cx="40" cy="58" r="2" fill="#60A5FA" />
      
      {/* Patinhas na frente (segurando algo) */}
      <ellipse cx="35" cy="75" rx="8" ry="6" fill="white" />
      <ellipse cx="65" cy="75" rx="8" ry="6" fill="white" />
      
      {/* Corpo */}
      <path d="M 30 65 Q 30 85 50 85 Q 70 85 70 65" fill="white" />
    </g>
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
          {/* Sad Dog Icon - Datadog Style */}
          <div className="mb-6 animate-bounce-slow">
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-purple-100 to-violet-100 rounded-full flex items-center justify-center">
              <SadDogIcon />
            </div>
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
