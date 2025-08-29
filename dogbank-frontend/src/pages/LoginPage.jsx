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
    <div className="min-h-screen flex flex-col bg-primary-500">
      {/* Conteúdo central */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg overflow-hidden p-6 sm:p-8">
          <div className="text-center mb-6">
            <img
              src={dogbankLogo}
              alt="DogBank Logo"
              className="h-40 mx-auto mb-4"
            />
          </div>
          {/* Passa o callback para o formulário capturar o CPF */}
          <LoginForm onSubmit={handleCpfSubmit} />
        </div>
      </div>

      {/* Rodapé */}
      <footer className="text-center p-4 text-white text-sm">
        <p>DogBank © {new Date().getFullYear()} – Todos os direitos reservados</p>
        <p className="mt-1 text-primary-200">
          Este é um projeto de demonstração. Não é um banco real.
        </p>
      </footer>
    </div>
  );
};

export default LoginPage;