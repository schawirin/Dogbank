import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Lock, ChevronRight, Shield, Zap } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import dogbankLogo from '../assets/images/dogbank-logo.png';

/**
 * Página de login (CPF) - Design moderno com visual premium
 */
const LoginPage = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [cpf, setCpf] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleCpfChange = (e) => {
    const onlyNumbers = e.target.value.replace(/\D/g, '');
    const truncated = onlyNumbers.slice(0, 11);
    setCpf(truncated);
    if (error) setError('');
  };

  const formatCpf = (value) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const cleanCpf = cpf.replace(/\D/g, '');

    if (cleanCpf.length !== 11) {
      setError('CPF inválido. Digite os 11 dígitos do seu CPF.');
      setLoading(false);
      return;
    }

    sessionStorage.setItem('loginCpf', cleanCpf);
    navigate('/password', { state: { cpf: cleanCpf } });
  };

  return (
    <div className="min-h-screen flex">
      {/* LEFT SIDE - Visual/Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 p-12 items-center justify-center relative overflow-hidden">
        {/* Animated Background Effects */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse-slow" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-600/20 rounded-full blur-3xl animate-pulse-slow animation-delay-2000" />
          <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl animate-pulse-slow animation-delay-4000" />
        </div>

        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.03)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]" />

        {/* Content */}
        <div className={`relative z-10 text-white max-w-lg transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Logo */}
          <div className="flex items-center gap-4 mb-12">
            <img src={dogbankLogo} alt="DogBank" className="h-16 w-auto" />
          </div>

          <h1 className="text-5xl font-bold mb-6 leading-tight">
            Bem-vindo de volta
          </h1>
          <p className="text-xl text-white/70 leading-relaxed">
            Acesse sua conta e gerencie suas finanças de forma simples e segura.
          </p>

          {/* Features */}
          <div className="mt-12 space-y-6">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center">
                <Lock size={24} />
              </div>
              <div>
                <h3 className="font-semibold">Segurança Avançada</h3>
                <p className="text-sm text-white/60">Autenticação em 2 etapas</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center">
                <Zap size={24} />
              </div>
              <div>
                <h3 className="font-semibold">PIX Instantâneo</h3>
                <p className="text-sm text-white/60">Transferências em segundos</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-slate-50">
        <div className={`w-full max-w-md transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Back button */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-8 transition-colors group"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            Voltar ao início
          </Link>

          {/* Logo mobile */}
          <div className="lg:hidden flex justify-center mb-8">
            <img src={dogbankLogo} alt="DogBank" className="h-12 w-auto" />
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Entre na sua conta</h2>
            <p className="text-slate-500">Digite seu CPF para continuar</p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 flex items-center gap-3">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-red-500">!</span>
              </div>
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="cpf" className="block text-sm font-semibold text-slate-700 mb-2">
                CPF
              </label>
              <input
                type="text"
                id="cpf"
                value={formatCpf(cpf)}
                onChange={handleCpfChange}
                placeholder="000.000.000-00"
                className="w-full px-5 py-4 bg-white border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all text-lg font-medium text-slate-900 placeholder:text-slate-400"
                required
                maxLength={14}
              />
            </div>

            <button
              type="submit"
              disabled={loading || cpf.length < 11}
              className="w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white py-4 rounded-2xl font-semibold text-lg hover:from-violet-500 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Verificando...</span>
                </>
              ) : (
                <>
                  Continuar
                  <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-slate-500 text-sm">
              Não tem uma conta?{' '}
              <button className="text-purple-600 font-semibold hover:text-purple-700 transition-colors">
                Criar conta
              </button>
            </p>
          </div>

          {/* Disclaimer */}
          <div className="mt-12 text-center">
            <p className="text-xs text-slate-400">
              Este é um projeto de demonstração. Não é um banco real.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
