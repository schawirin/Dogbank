import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import authService from '../../services/authService';
import Input from '../common/Input';
import Button from '../common/Button';
import Alert from '../common/Alert';

const PasswordForm = () => {
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const { login } = useAuth();
  
  useEffect(() => {
    // Recuperar CPF da sessão
    const loginCpf = sessionStorage.getItem('loginCpf');
    
    if (!loginCpf) {
      // Se não existe CPF no sessionStorage, redirecionar para a página de login
      navigate('/login');
      return;
    }
    
    setCpf(loginCpf);
  }, [navigate]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!password.trim()) {
      setError('Digite sua senha');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Chamar o serviço de autenticação
      const response = await authService.login(cpf, password);
      
      console.log('Resposta do login:', response); // Debug
      
      // Login bem-sucedido - salvar dados completos incluindo ID
      login({ 
        id: response.id,
        nome: response.nome, 
        cpf: cpf,
        chavePix: response.chavePix 
      }, "fake-token-for-demo");
      
      // Salvar userId no localStorage como fallback
      localStorage.setItem('userId', response.id);
      
      // Limpar CPF da sessão
      sessionStorage.removeItem('loginCpf');
      
      // Redirecionar para o dashboard
      navigate('/dashboard');
    } catch (err) {
      console.error('Erro de login:', err);
      setError('Senha incorreta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleBack = () => {
    navigate('/login');
  };
  
  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-neutral-800">Digite sua senha</h1>
        <p className="text-neutral-500 mt-2">
          Para acessar sua conta DogBank
        </p>
      </div>
      
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
          label="Senha"
          type="password"
          id="password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Digite sua senha"
        />
        
        <div className="flex space-x-4">
          <Button 
            type="button" 
            variant="outline" 
            size="lg" 
            fullWidth 
            onClick={handleBack}
          >
            Voltar
          </Button>
          
          <Button 
            type="submit" 
            variant="primary" 
            size="lg" 
            fullWidth 
            disabled={loading}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </div>
      </form>
      
      <div className="mt-6 text-center">
        <a href="/forgot-password" className="text-sm text-primary-500 hover:text-primary-600">
          Esqueci minha senha
        </a>
      </div>
    </div>
  );
};

export default PasswordForm;