import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ArrowLeft, Shield, Delete, AlertCircle, UserX } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import authService from '../services/authService';
import dogbankLogo from '../assets/images/dogbank-logo.png';

const PIN_LENGTH = 6;
const KEYPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

/**
 * Página de senha/PIN - Redesenhada com split layout
 * - Left side: Visual branding
 * - Right side: Teclado numérico para PIN
 */
const PasswordPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [cpf, setCpf] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [errorType, setErrorType] = useState(''); // 'user_not_found', 'wrong_password', 'generic'
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Pega o CPF que veio de LoginPage via state
  useEffect(() => {
    setIsVisible(true);
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
      setErrorType('');
    }
  };

  const removeDigit = () => {
    setPin(p => p.slice(0, -1));
    setError('');
    setErrorType('');
  };

  const handleKeypadClick = (key) => {
    if (key === 'del') {
      removeDigit();
    } else if (key !== '') {
      addDigit(key);
    }
  };

  // Função para mapear erros do backend para mensagens amigáveis
  const getErrorMessage = (err) => {
    const errorData = err.response?.data;
    const errorMessage = errorData?.error || errorData?.message || err.message || '';
    const statusCode = err.response?.status;

    console.log('🔍 Analisando erro:', { errorData, errorMessage, statusCode });

    // User not found
    if (errorMessage.toLowerCase().includes('user not found') || 
        errorMessage.toLowerCase().includes('usuário não encontrado') ||
        errorMessage.toLowerCase().includes('cpf não encontrado')) {
      setErrorType('user_not_found');
      return 'CPF não cadastrado. Verifique o número digitado ou crie uma conta.';
    }

    // Wrong password
    if (errorMessage.toLowerCase().includes('senha incorreta') ||
        errorMessage.toLowerCase().includes('wrong password') ||
        errorMessage.toLowerCase().includes('invalid password') ||
        errorMessage.toLowerCase().includes('senha inválida') ||
        statusCode === 401) {
      setErrorType('wrong_password');
      return 'Senha incorreta. Verifique e tente novamente.';
    }

    // Connection error
    if (err.code === 'ERR_NETWORK' || errorMessage.includes('Network Error')) {
      setErrorType('generic');
      return 'Erro de conexão. Verifique sua internet e tente novamente.';
    }

    // Generic error
    setErrorType('generic');
    return errorMessage || 'Ocorreu um erro. Tente novamente.';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (pin.length !== PIN_LENGTH) {
      setError(`Digite os ${PIN_LENGTH} dígitos da senha.`);
      setErrorType('generic');
      return;
    }

    setLoading(true);
    setError('');
    setErrorType('');

    try {
      // Chama a API de login
      const resp = await authService.login(cpf, pin);
      
      const userObj = {
        cpf: cpf,
        nome: resp.nome,
        chavePix: resp.chavePix,
        accountId: resp.accountId
      };
      
      const token = resp.token || resp.accessToken || `dogbank_session_${Date.now()}_${resp.accountId}`;

      // Passa para o contexto de autenticação
      login(userObj, token);

      // Aguarda React processar estado antes de navegar
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 0);

    } catch (err) {
      console.error('Erro no login:', err);
      const friendlyMessage = getErrorMessage(err);
      setError(friendlyMessage);
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const formatCpf = (value) => {
    if (!value) return '';
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  // Renderiza o alerta de erro com estilo apropriado
  const renderErrorAlert = () => {
    if (!error) return null;

    const isUserNotFound = errorType === 'user_not_found';
    
    return (
      <div className={`mb-6 p-4 rounded-2xl flex items-start gap-3 animate-fade-in ${
        isUserNotFound 
          ? 'bg-amber-50 border border-amber-200' 
          : 'bg-red-50 border border-red-200'
      }`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isUserNotFound ? 'bg-amber-100' : 'bg-red-100'
        }`}>
          {isUserNotFound ? (
            <UserX className={`w-5 h-5 text-amber-600`} />
          ) : (
            <AlertCircle className={`w-5 h-5 text-red-600`} />
          )}
        </div>
        <div className="flex-1">
          <p className={`font-medium ${isUserNotFound ? 'text-amber-800' : 'text-red-800'}`}>
            {isUserNotFound ? 'Usuário não encontrado' : 'Erro no login'}
          </p>
          <p className={`text-sm mt-1 ${isUserNotFound ? 'text-amber-700' : 'text-red-700'}`}>
            {error}
          </p>
          {isUserNotFound && (
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="mt-3 text-sm font-semibold text-amber-700 hover:text-amber-800 underline"
            >
              ← Voltar e verificar o CPF
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex">
      {/* LEFT SIDE - Visual/Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 p-12 items-center justify-center relative overflow-hidden">
        {/* Animated Background Effects */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse-slow" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-600/20 rounded-full blur-3xl animate-pulse-slow animation-delay-2000" />
        </div>

        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.03)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]" />

        {/* Content */}
        <div className={`relative z-10 text-white max-w-lg transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Logo */}
          <div className="flex items-center gap-4 mb-12">
            <img src={dogbankLogo} alt="DogBank" className="h-14 w-auto" />
            <span className="text-2xl font-bold">DogBank</span>
          </div>

          <h1 className="text-5xl font-bold mb-6 leading-tight">Acesso Seguro</h1>
          <p className="text-xl text-white/70 leading-relaxed">
            Digite sua senha de 6 dígitos para acessar sua conta com total segurança.
          </p>

          <div className="mt-12 space-y-6">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center">
                <Shield size={24} />
              </div>
              <div>
                <h3 className="font-semibold">Criptografia Avançada</h3>
                <p className="text-sm text-white/60">Seus dados protegidos com tecnologia de ponta</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE - Password Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-slate-50">
        <div className={`w-full max-w-md transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Back button */}
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-8 transition-colors group"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            Voltar
          </Link>

          {/* Logo mobile */}
          <div className="lg:hidden flex justify-center mb-8">
            <img src={dogbankLogo} alt="DogBank" className="h-12 w-auto" />
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Digite sua senha</h2>
            <p className="text-slate-500">CPF: {formatCpf(cpf)}</p>
          </div>

          {/* PIN Dots */}
          <div className="flex justify-center gap-3 mb-8">
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <span
                key={i}
                className={`h-4 w-4 rounded-full transition-all duration-200 ${
                  i < pin.length
                    ? 'bg-gradient-to-r from-violet-600 to-purple-600 scale-110 shadow-lg shadow-purple-500/30'
                    : 'border-2 border-slate-300 bg-white'
                }`}
              />
            ))}
          </div>

          {/* Error Alert - Agora com mensagens claras */}
          {renderErrorAlert()}

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
                      className="py-4 rounded-2xl bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100 transition-all flex items-center justify-center shadow-sm"
                    >
                      <Delete size={24} className="text-slate-500" />
                    </button>
                  );
                }
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleKeypadClick(key)}
                    className="py-4 rounded-2xl bg-white border-2 border-slate-200 hover:border-purple-400 hover:bg-purple-50 active:bg-purple-100 transition-all text-xl font-semibold text-slate-700 shadow-sm"
                  >
                    {key}
                  </button>
                );
              })}
            </div>

            <button
              type="submit"
              disabled={pin.length !== PIN_LENGTH || loading}
              className="w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white py-4 rounded-2xl font-semibold text-lg hover:from-violet-500 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Validando...</span>
                </>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-slate-500 text-sm">
              Esqueceu a senha?{' '}
              <button className="text-purple-600 font-semibold hover:text-purple-700 transition-colors">
                Recuperar acesso
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

export default PasswordPage;
