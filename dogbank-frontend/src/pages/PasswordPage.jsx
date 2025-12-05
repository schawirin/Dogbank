// src/pages/PasswordPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import authService from '../services/authService';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Alert from '../components/common/Alert';
import { ArrowLeftOnRectangleIcon } from '@heroicons/react/24/outline';

const PIN_LENGTH = 6;
const KEYPAD = ['1','2','3','4','5','6','7','8','9','0'];

const PasswordPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [cpf, setCpf] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 1) Pega o CPF que veio de LoginPage via state
  useEffect(() => {
    const fromState = location.state?.cpf;
    if (!fromState) {
      navigate('/login', { replace: true });
      return;
    }
    setCpf(fromState);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (pin.length !== PIN_LENGTH) {
      setError(`Digite os ${PIN_LENGTH} dígitos da senha.`);
      return;
    }

    setLoading(true);
    setError('');
    try {
      // Chama o authService que já salva os dados no localStorage
      const { nome, chavePix, accountId } = await authService.login(cpf, pin);

      // Atualiza o contexto com os dados do usuário
      // Como não temos token real, usamos um token fake para manter compatibilidade
      const userObj = {
        cpf,
        nome,
        chavePix,
        id: accountId
      };
      login(userObj, 'fake-token');

      navigate('/app/dashboard', { replace: true });

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
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <Card className="w-full max-w-sm sm:max-w-md lg:max-w-lg py-10 text-center">
        <h1 className="text-xl sm:text-2xl font-semibold mb-2">
          Digite sua senha de acesso
        </h1>
        <p className="text-sm text-neutral-500 mb-4">
          CPF: <span className="font-medium">{cpf}</span>
        </p>

        <div className="flex justify-center gap-4 mb-6">
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <span
              key={i}
              className={`h-3 w-3 sm:h-4 sm:w-4 rounded-full transition-colors ${
                i < pin.length ? 'bg-primary-500' : 'border border-neutral-400'
              }`}
            />
          ))}
        </div>

        {error && (
          <Alert
            type="error"
            message={error}
            onClose={() => setError('')}
            className="mb-6"
          />
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-3 gap-3 mb-8 max-w-xs mx-auto">
            {KEYPAD.map(d => (
              <button
                key={d}
                type="button"
                onClick={() => addDigit(d)}
                className="py-3 sm:py-4 rounded-lg border border-neutral-300 hover:bg-primary-50 active:bg-primary-100 transition text-lg font-medium"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={removeDigit}
              className="py-3 sm:py-4 rounded-lg border border-neutral-300 hover:bg-neutral-100 active:bg-neutral-200 flex items-center justify-center"
            >
              <ArrowLeftOnRectangleIcon className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>

          <Button
            type="submit"
            disabled={pin.length !== PIN_LENGTH || loading}
            fullWidth
            size="lg"
          >
            {loading ? 'Validando…' : 'Entrar'}
          </Button>
        </form>

        <p className="mt-6 text-sm text-neutral-500">
          Esqueceu a senha? Abra o app para redefinir.
        </p>
      </Card>
    </div>
  );
};

export default PasswordPage;
