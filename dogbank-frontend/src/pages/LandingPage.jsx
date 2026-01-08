import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Shield, Zap, Lock } from 'lucide-react';
import dogbankLogo from '../assets/images/dogbank-logo.png';

export default function LandingPage() {
  const navigate = useNavigate();

  const handleLoginClick = () => {
    // Limpa qualquer sessão anterior antes de ir para login
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.clear();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary-900 to-background relative overflow-hidden">
      {/* Animated Floating Circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="floating-circle floating-circle-1"></div>
        <div className="floating-circle floating-circle-2"></div>
        <div className="floating-circle floating-circle-3"></div>
        <div className="floating-circle floating-circle-4"></div>
        <div className="floating-circle floating-circle-5"></div>
      </div>

      {/* HERO SECTION */}
      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Logo Real DogBank */}
          <div className="flex justify-center mb-8">
            <img
              src={dogbankLogo}
              alt="DogBank"
              className="h-24 w-auto"
            />
          </div>

          {/* Heading */}
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-primary-200 to-white bg-clip-text text-transparent">
            Banco Digital
            <br />
            Simples e Seguro
          </h1>

          {/* Subheading */}
          <p className="text-xl md:text-2xl text-foreground/80 mb-12 max-w-2xl mx-auto">
            Transferências PIX instantâneas, seguras e sem complicação.
            Seu dinheiro sob controle, 24h por dia.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleLoginClick}
              className="inline-flex items-center justify-center px-8 py-4 bg-primary-500 text-white rounded-xl font-semibold text-lg hover:bg-primary-600 transition-all hover:scale-105 shadow-lg shadow-primary-500/50"
            >
              Entrar
              <ChevronRight className="ml-2" size={20} />
            </button>
            <button className="inline-flex items-center justify-center px-8 py-4 bg-white/10 text-white rounded-xl font-semibold text-lg hover:bg-white/20 transition-all border border-white/20">
              Criar Conta
            </button>
          </div>
        </div>

        {/* FEATURES (Minimalistas) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 max-w-5xl mx-auto">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Zap className="text-primary-500" size={32} />
            </div>
            <h3 className="text-xl font-semibold mb-2">Instantâneo</h3>
            <p className="text-foreground/70">Transferências PIX em segundos, 24h por dia</p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-primary-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Shield className="text-primary-500" size={32} />
            </div>
            <h3 className="text-xl font-semibold mb-2">Seguro</h3>
            <p className="text-foreground/70">Proteção avançada com autenticação em 2 etapas</p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-primary-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Lock className="text-primary-500" size={32} />
            </div>
            <h3 className="text-xl font-semibold mb-2">Transparente</h3>
            <p className="text-foreground/70">Sem tarifas escondidas, tudo claro e direto</p>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="border-t border-white/10 py-8 mt-20">
        <div className="container mx-auto px-4 text-center text-foreground/60">
          <p>© 2025 DogBank. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
