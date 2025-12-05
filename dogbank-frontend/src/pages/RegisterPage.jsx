import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Alert from '../components/common/Alert';
import dogbankLogo from '../assets/images/dogbank-logo.png';

const RegisterPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    email: '',
    telefone: ''
  });
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Mock: apenas mostra mensagem de sucesso
    setSuccess(true);
    setTimeout(() => {
      navigate('/login');
    }, 2000);
  };

  return (
    <div className="min-h-screen flex flex-col gradient-animated relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white opacity-5 rounded-full blur-3xl animate-float"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white opacity-5 rounded-full blur-3xl animate-float delay-500"></div>
      </div>

      {/* Conteúdo central */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 relative z-10">
        <div className="max-w-md w-full glass rounded-3xl shadow-elevated overflow-hidden p-8 sm:p-10 animate-scale-in backdrop-blur-lg">
          <div className="text-center mb-8">
            <img
              src={dogbankLogo}
              alt="DogBank Logo"
              className="h-32 mx-auto mb-4"
            />
            <h1 className="text-2xl font-bold text-gradient font-display mb-2">
              Abra sua conta
            </h1>
            <p className="text-neutral-600">
              Preencha seus dados para começar
            </p>
          </div>

          {success && (
            <Alert
              type="success"
              message="Cadastro realizado! Redirecionando para o login..."
              className="mb-6"
            />
          )}

          {!success && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Nome completo"
                type="text"
                id="nome"
                name="nome"
                value={formData.nome}
                onChange={handleChange}
                placeholder="Seu nome completo"
                required
              />

              <Input
                label="CPF"
                type="text"
                id="cpf"
                name="cpf"
                value={formData.cpf}
                onChange={handleChange}
                placeholder="000.000.000-00"
                required
              />

              <Input
                label="E-mail"
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="seu@email.com"
                required
              />

              <Input
                label="Telefone"
                type="tel"
                id="telefone"
                name="telefone"
                value={formData.telefone}
                onChange={handleChange}
                placeholder="(00) 00000-0000"
                required
              />

              <Button type="submit" variant="primary" size="lg" fullWidth className="mt-6">
                Criar conta
              </Button>

              <button
                type="button"
                onClick={() => navigate('/')}
                className="w-full text-center text-sm text-neutral-500 hover:text-neutral-700 mt-4"
              >
                Voltar
              </button>
            </form>
          )}

          <div className="mt-6 text-center text-xs text-neutral-500">
            <p>Ao criar sua conta, você concorda com nossos</p>
            <p className="mt-1">
              <span className="text-primary-500 hover:underline cursor-pointer">Termos de Uso</span>
              {' e '}
              <span className="text-primary-500 hover:underline cursor-pointer">Política de Privacidade</span>
            </p>
          </div>
        </div>
      </div>

      {/* Rodapé */}
      <footer className="text-center p-6 text-white/60 text-sm relative z-10 animate-fade-in">
        <p className="font-medium">DogBank © {new Date().getFullYear()}</p>
        <p className="mt-2">
          Ambiente de laboratório
        </p>
      </footer>
    </div>
  );
};

export default RegisterPage;
