import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Input from '../common/Input';
import Button from '../common/Button';
import Alert from '../common/Alert';

const LoginForm = () => {
  const [cpf, setCpf] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Atualiza CPF e limpa erro
  const handleCpfChange = (e) => {
    const onlyNumbers = e.target.value.replace(/\D/g, '');
    // Limita a 11 dígitos
    const truncated = onlyNumbers.slice(0, 11);
    setCpf(truncated);
    if (error) setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // CPF sem formatação
    const cleanCpf = cpf.replace(/\D/g, '');

    // Validação básica
    if (cleanCpf.length !== 11) {
      setError('CPF inválido. Digite os 11 dígitos do seu CPF.');
      return;
    }

    // Armazena CPF e navega para senha
    sessionStorage.setItem('loginCpf', cleanCpf);
    navigate('/password', { state: { cpf: cleanCpf } });
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {error && (
        <Alert
          type="error"
          message={error}
          onClose={() => setError('')}
          className="mb-6"
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Input
          label="CPF"
          type="text"
          id="cpf"
          name="cpf"
          value={cpf}
          onChange={handleCpfChange}
          placeholder="000.000.000-00"
          maxLength={14} // com pontuação
        />

        <Button type="submit" variant="primary" size="lg" fullWidth>
          Continuar
        </Button>
      </form>

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-sm text-neutral-500 hover:text-neutral-700"
        >
          ← Voltar
        </button>
      </div>
    </div>
  );
};

export default LoginForm;