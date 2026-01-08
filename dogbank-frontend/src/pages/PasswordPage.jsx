import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ArrowLeft, Shield, Delete } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import authService from '../services/authService';

const PIN_LENGTH = 6;
const KEYPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

/**
 * Página de senha/PIN - Redesenhada com split layout
 * - Left side: Visual branding com roxo Datadog
 * - Right side: Teclado numérico para PIN
 */
const PasswordPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [cpf, setCpf] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Pega o CPF que veio de LoginPage via state
  useEffect(() => {
    const fromState = location.state?.cpf;
    const fromSession = sessionStorage.getItem('loginCpf');
    const finalCpf = fromState || fromSession;

    if (!finalCpf) {
      navigate('/login', { replace: true });
      return;
    }
    setCpf(finalCpf);
  }, [location.state, navigate]);

  const addDigit = (d) => {
    if (pin.length < PIN_LENGTH) {
      setPin(p => p + d);
      setError('');
    }
  };

  const removeDigit = () => {
    setPin(p => p.slice(0, -1));
    setError('');
  };

  const handleKeypadClick = (key) => {
    if (key === 'del') {
      removeDigit();
    } else if (key !== '') {
      addDigit(key);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (pin.length !== PIN_LENGTH) {
      setError(`Digite os ${PIN_LENGTH} dígitos da senha.`);
      return;
    }

    setLoading(true);
    setError('');
    try {
      // Chama a API de login
      const resp = await authService.login(cpf, pin);
      
      // ✅ CORREÇÃO: O authService.login() retorna { nome, chavePix, accountId }
      // Precisamos construir o objeto user corretamente e gerar um token placeholder
      // já que o backend não retorna um token JWT neste endpoint
      
      const userObj = {
        cpf: cpf,
        nome: resp.nome,
        chavePix: resp.chavePix,
        accountId: resp.accountId
      };
      
      // Gera um token simples baseado no timestamp (ou use um token real se o backend fornecer)
      // Em produção, o backend deveria retornar um JWT token
      const token = resp.token || resp.accessToken || `dogbank_session_${Date.now()}_${resp.accountId}`;

      // Passa para o contexto de autenticação
      login(userObj, token);

      // ✅ Aguarda React processar estado antes de navegar
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 0);

    } catch (err) {
      console.error('Erro no login:', err);
      setError(
        err.response?.data?.message ||
        err.message ||
        'Senha incorreta. Tente novamente.'
      );
      setPin('');
    } finally {
      setLoading(false);
    }
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
          <h1 className="text-5xl font-bold mb-4">Acesso Seguro</h1>
          <p className="text-xl text-white/90">
            Digite sua senha de 6 dígitos para acessar sua conta com total segurança.
          </p>

          <div className="mt-12 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Shield size={24} />
              </div>
              <div>
                <h3 className="font-semibold">Criptografia Avançada</h3>
                <p className="text-sm text-white/80">Seus dados protegidos com tecnologia de ponta</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE - Password Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          {/* Back button */}
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-foreground/60 hover:text-foreground mb-8 transition-colors"
          >
            <ArrowLeft size={20} />
            Voltar
          </Link>

          {/* Logo mobile */}
          <div className="lg:hidden flex justify-center mb-8">
            <div className="w-16 h-16 bg-primary-500 rounded-2xl flex items-center justify-center">
              <span className="text-2xl font-bold text-white">D</span>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">Digite sua senha</h2>
            <p className="text-foreground/60">CPF: {cpf}</p>
          </div>

          {/* PIN Dots */}
          <div className="flex justify-center gap-3 mb-8">
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <span
                key={i}
                className={`h-4 w-4 rounded-full transition-all ${
                  i < pin.length
                    ? 'bg-primary-500 scale-110'
                    : 'border-2 border-border'
                }`}
              />
            ))}
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-center">
              {error}
            </div>
          )}

          {/* Keypad */}
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-3 gap-3 mb-8 max-w-xs mx-auto">
              {KEYPAD.map((key, idx) => {
                if (key === '') {
                  return <div key={idx} />;
                }
                if (key === 'del') {
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleKeypadClick('del')}
                      className="py-4 rounded-xl border border-border hover:bg-accent active:bg-accent/80 transition flex items-center justify-center"
                    >
                      <Delete size={24} className="text-foreground/60" />
                    </button>
                  );
                }
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleKeypadClick(key)}
                    className="py-4 rounded-xl border border-border hover:bg-primary-500/10 hover:border-primary-500 active:bg-primary-500/20 transition text-lg font-semibold"
                  >
                    {key}
                  </button>
                );
              })}
            </div>

            <button
              type="submit"
              disabled={pin.length !== PIN_LENGTH || loading}
              className="w-full bg-primary-500 text-white py-4 rounded-xl font-semibold text-lg hover:bg-primary-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 hover:scale-[1.02]"
            >
              {loading ? 'Validando...' : 'Entrar'}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-foreground/60 text-sm">
              Esqueceu a senha?{' '}
              <button className="text-primary-500 font-semibold hover:text-primary-600">
                Recuperar acesso
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

export default PasswordPage;
