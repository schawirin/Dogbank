import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Lock, ChevronRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

/**
 * Página de login (CPF) - Redesenhada com split layout
 * - Redireciona para /dashboard se já autenticado
 * - Left side: Visual branding com roxo Datadog
 * - Right side: Formulário de CPF
 */
const LoginPage = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [cpf, setCpf] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Se já autenticado, vai direto ao dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Atualiza CPF e limpa erro
  const handleCpfChange = (e) => {
    const onlyNumbers = e.target.value.replace(/\D/g, '');
    // Limita a 11 dígitos
    const truncated = onlyNumbers.slice(0, 11);
    setCpf(truncated);
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // CPF sem formatação
    const cleanCpf = cpf.replace(/\D/g, '');

    // Validação básica
    if (cleanCpf.length !== 11) {
      setError('CPF inválido. Digite os 11 dígitos do seu CPF.');
      setLoading(false);
      return;
    }

    // Armazena CPF e navega para senha
    sessionStorage.setItem('loginCpf', cleanCpf);
    navigate('/password', { state: { cpf: cleanCpf } });
  };

  return (
    <div className="min-h-screen flex">
      {/* LEFT SIDE - Visual/Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-900 via-primary-700 to-primary-500 p-12 items-center justify-center relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 text-white max-w-lg">
          <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center mb-8">
            <span className="text-5xl font-bold">D</span>
          </div>
          <h1 className="text-5xl font-bold mb-4">Bem-vindo ao DogBank</h1>
          <p className="text-xl text-white/90">
            Banco digital simples, rápido e seguro.
            Suas transações PIX em segundos.
          </p>

          <div className="mt-12 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Lock size={24} />
              </div>
              <div>
                <h3 className="font-semibold">100% Seguro</h3>
                <p className="text-sm text-white/80">Proteção avançada em 2 etapas</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          {/* Back button */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-foreground/60 hover:text-foreground mb-8 transition-colors"
          >
            <ArrowLeft size={20} />
            Voltar ao início
          </Link>

          {/* Logo mobile */}
          <div className="lg:hidden flex justify-center mb-8">
            <div className="w-16 h-16 bg-primary-500 rounded-2xl flex items-center justify-center">
              <span className="text-2xl font-bold text-white">D</span>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">Entre na sua conta</h2>
            <p className="text-foreground/60">Digite seu CPF para continuar</p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="cpf" className="block text-sm font-medium mb-2">
                CPF
              </label>
              <input
                type="text"
                id="cpf"
                value={cpf}
                onChange={handleCpfChange}
                placeholder="000.000.000-00"
                className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-lg"
                required
                maxLength={14}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-500 text-white py-4 rounded-xl font-semibold text-lg hover:bg-primary-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 hover:scale-[1.02]"
            >
              Continuar
              <ChevronRight size={20} />
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-foreground/60 text-sm">
              Não tem uma conta?{' '}
              <button className="text-primary-500 font-semibold hover:text-primary-600">
                Criar conta
              </button>
            </p>
          </div>

          {/* Disclaimer */}
          <div className="mt-12 text-center text-xs text-foreground/40">
            <p>Este é um projeto de demonstração. Não é um banco real.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
