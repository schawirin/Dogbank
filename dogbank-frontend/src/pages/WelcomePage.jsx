import React from 'react';
import { useNavigate } from 'react-router-dom';
import dogbankLogo from '../assets/images/dogbank-logo.png';

const WelcomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col gradient-animated relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white opacity-5 rounded-full blur-3xl animate-float"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white opacity-5 rounded-full blur-3xl animate-float delay-500"></div>
      </div>

      {/* Conteúdo central */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 relative z-10">
        <div className="max-w-md w-full text-center">
          {/* Logo */}
          <img
            src={dogbankLogo}
            alt="DogBank Logo"
            className="h-48 mx-auto mb-8 animate-bounce-slow"
          />

          {/* Título */}
          <h1 className="text-4xl font-bold text-white font-display mb-4 animate-fade-in-down">
            Bem-vindo ao DogBank
          </h1>
          <p className="text-white/80 text-lg mb-12 animate-fade-in-up delay-100">
            O banco digital feito para você
          </p>

          {/* Botões */}
          <div className="space-y-4 animate-fade-in-up delay-200">
            <button
              onClick={() => navigate('/login')}
              className="w-full py-4 px-6 bg-white text-primary-600 rounded-2xl font-semibold text-lg hover:bg-opacity-90 transition-all duration-300 hover:scale-105 shadow-lg"
            >
              Já sou cliente
            </button>

            <button
              onClick={() => navigate('/register')}
              className="w-full py-4 px-6 bg-transparent border-2 border-white text-white rounded-2xl font-semibold text-lg hover:bg-white hover:text-primary-600 transition-all duration-300 hover:scale-105"
            >
              Abrir minha conta
            </button>
          </div>

          {/* Info adicional */}
          <div className="mt-12 text-white/60 text-sm animate-fade-in delay-300">
            <p>Conta digital gratuita</p>
            <p className="mt-1">Sem taxas, sem burocracia</p>
          </div>
        </div>
      </div>

      {/* Rodapé */}
      <footer className="text-center p-6 text-white/60 text-sm relative z-10 animate-fade-in">
        <p>DogBank © {new Date().getFullYear()} – Banco Digital</p>
        <p className="mt-2 text-white/40">
          Ambiente de laboratório
        </p>
      </footer>
    </div>
  );
};

export default WelcomePage;
