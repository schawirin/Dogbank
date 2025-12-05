// src/pages/LoginPage.jsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoginForm from '../components/auth/LoginForm';
import dogbankLogo from '../assets/images/dogbank-logo.png';

/**
 * Página de login (CPF):
 * - Redireciona para /dashboard se já autenticado
 * - Exibe o LoginForm para captura de CPF
 */
const LoginPage = () => {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();

  // Se já autenticado, vai direto ao dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Quando o usuário submete o CPF
  const handleCpfSubmit = (cpf) => {
    // Salva o CPF no contexto (token fica null por enquanto)
    login({ cpf }, null);
    // Avança para a tela de PIN/Senha
    navigate('/password');
  };

  return (
    <div className="min-h-screen flex flex-col gradient-animated relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white opacity-10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white opacity-10 rounded-full blur-3xl animate-float delay-500"></div>
      </div>

      {/* Conteúdo central */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 relative z-10">
        <div className="max-w-md w-full glass rounded-3xl shadow-elevated overflow-hidden p-8 sm:p-10 animate-scale-in backdrop-blur-lg">
          <div className="text-center mb-8">
            <img
              src={dogbankLogo}
              alt="DogBank Logo"
              className="h-40 mx-auto mb-4 animate-bounce-slow"
            />
            <h1 className="text-2xl font-bold text-gradient font-display mb-2">
              Bem-vindo ao DogBank
            </h1>
            <p className="text-neutral-600">
              Entre com seu CPF para continuar
            </p>
          </div>
          {/* Passa o callback para o formulário capturar o CPF */}
          <LoginForm onSubmit={handleCpfSubmit} />
        </div>
      </div>

      {/* Rodapé */}
      <footer className="text-center p-6 text-white text-sm relative z-10 animate-fade-in">
        <p className="font-medium">DogBank © {new Date().getFullYear()} – Todos os direitos reservados</p>
        <p className="mt-2 text-white/80">
          Este é um projeto de demonstração. Não é um banco real.
        </p>
      </footer>
    </div>
  );
};

export default LoginPage;