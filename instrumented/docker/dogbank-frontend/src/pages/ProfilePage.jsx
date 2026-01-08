// src/pages/ProfilePage.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import accountService from '../services/accountService';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Alert from '../components/common/Alert';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  CreditCard, 
  Shield, 
  Key, 
  Building2, 
  FileText,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Star,
  Copy,
  Edit,
  LogOut
} from 'lucide-react';

const ProfilePage = () => {
  const { user, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();

  const [accountData, setAccountData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  // Dados mockados para endereço e análise de crédito
  const mockAddress = {
    street: 'Rua das Flores',
    number: '1234',
    complement: 'Apto 501',
    neighborhood: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01310-100'
  };

  const mockCreditAnalysis = {
    score: 780,
    maxScore: 1000,
    rating: 'Excelente',
    lastUpdate: '2026-01-05',
    creditLimit: 15000,
    usedLimit: 3250,
    availableLimit: 11750,
    paymentHistory: 'Sem atrasos',
    accountAge: '3 anos e 2 meses',
    recommendations: [
      'Mantenha seus pagamentos em dia',
      'Evite utilizar mais de 30% do limite',
      'Diversifique suas fontes de crédito'
    ]
  };

  // Protege a rota
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [authLoading, user, navigate]);

  // Busca dados da conta
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        let chave = user?.cpf || localStorage.getItem('cpf');
        if (!chave) throw new Error('CPF não encontrado');

        const acct = await accountService.getAccountInfo(chave);
        setAccountData(acct);
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
        setError('Não foi possível carregar os dados. Tente novamente mais tarde.');
      } finally {
        setLoading(false);
      }
    };

    if (user || localStorage.getItem('cpf')) {
      fetchData();
    }
  }, [user]);

  const formatCPF = (cpf) => {
    if (!cpf) return 'N/A';
    const cleaned = cpf.replace(/\D/g, '');
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(''), 2000);
  };

  const getScoreColor = (score) => {
    if (score >= 700) return 'text-green-600';
    if (score >= 500) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBarColor = (score) => {
    if (score >= 700) return 'bg-green-500';
    if (score >= 500) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4" />
          <p className="text-slate-600">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  const cpf = user?.cpf || localStorage.getItem('cpf') || '';
  const email = user?.email || accountData?.email || `${user?.nome?.toLowerCase().replace(/\s/g, '.')}@email.com`;
  const phone = user?.phone || '(11) 98765-4321';
  const pixKey = user?.chavePix || accountData?.chavePix || email;

  return (
    <div className="py-6 max-w-5xl mx-auto">
      {/* Cabeçalho */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-1">
          Meu Perfil
        </h1>
        <p className="text-slate-500">
          Gerencie suas informações pessoais e configurações
        </p>
      </div>

      {error && (
        <Alert type="error" message={error} onClose={() => setError('')} className="mb-6" />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card do Perfil */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header com Avatar */}
            <div className="bg-gradient-to-r from-purple-600 to-violet-600 px-6 py-8">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-3xl font-bold text-purple-600">
                    {(user?.nome || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="text-white">
                  <h2 className="text-2xl font-bold">{user?.nome || 'Cliente DogBank'}</h2>
                  <p className="text-purple-200">Cliente desde 2023</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-2 py-1 bg-white/20 rounded-full text-xs font-medium">
                      Conta Premium
                    </span>
                    <span className="px-2 py-1 bg-green-500/30 rounded-full text-xs font-medium flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Verificado
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Informações Pessoais */}
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-purple-600" />
                Informações Pessoais
              </h3>
              
              <div className="space-y-4">
                {/* Nome */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <User className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Nome Completo</p>
                      <p className="font-medium text-slate-900">{user?.nome || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* CPF */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">CPF</p>
                      <p className="font-medium text-slate-900 font-mono">{formatCPF(cpf)}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => copyToClipboard(cpf, 'cpf')}
                    className="text-slate-400 hover:text-slate-600 p-2"
                  >
                    {copied === 'cpf' ? <CheckCircle className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>

                {/* Email */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <Mail className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">E-mail</p>
                      <p className="font-medium text-slate-900">{email}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => copyToClipboard(email, 'email')}
                    className="text-slate-400 hover:text-slate-600 p-2"
                  >
                    {copied === 'email' ? <CheckCircle className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>

                {/* Telefone */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <Phone className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Telefone</p>
                      <p className="font-medium text-slate-900">{phone}</p>
                    </div>
                  </div>
                </div>

                {/* Chave PIX */}
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl border border-purple-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Key className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Chave PIX</p>
                      <p className="font-medium text-purple-700">{pixKey}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => copyToClipboard(pixKey, 'pix')}
                    className="text-purple-400 hover:text-purple-600 p-2"
                  >
                    {copied === 'pix' ? <CheckCircle className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Endereço */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-purple-600" />
              Endereço
            </h3>
            
            <div className="p-4 bg-slate-50 rounded-xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Logradouro</p>
                  <p className="font-medium text-slate-900">{mockAddress.street}, {mockAddress.number}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Complemento</p>
                  <p className="font-medium text-slate-900">{mockAddress.complement}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Bairro</p>
                  <p className="font-medium text-slate-900">{mockAddress.neighborhood}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Cidade/Estado</p>
                  <p className="font-medium text-slate-900">{mockAddress.city} - {mockAddress.state}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">CEP</p>
                  <p className="font-medium text-slate-900 font-mono">{mockAddress.zipCode}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Dados Bancários */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-purple-600" />
              Dados Bancários
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl text-center">
                <p className="text-sm text-slate-500">Banco</p>
                <p className="font-bold text-slate-900">DogBank</p>
                <p className="text-xs text-slate-400">Código: 999</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl text-center">
                <p className="text-sm text-slate-500">Agência</p>
                <p className="font-bold text-slate-900 font-mono">
                  {accountData?.agencia || '0001'}
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl text-center">
                <p className="text-sm text-slate-500">Conta</p>
                <p className="font-bold text-slate-900 font-mono">
                  {accountData?.numero_conta || accountData?.accountNumber || '000000-0'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Coluna Lateral */}
        <div className="space-y-6">
          {/* Análise de Crédito */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              Análise de Crédito
            </h3>

            {/* Score */}
            <div className="text-center mb-6">
              <div className="relative inline-flex items-center justify-center">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="#e2e8f0"
                    strokeWidth="12"
                    fill="none"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="#22c55e"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${(mockCreditAnalysis.score / mockCreditAnalysis.maxScore) * 352} 352`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute">
                  <p className={`text-3xl font-bold ${getScoreColor(mockCreditAnalysis.score)}`}>
                    {mockCreditAnalysis.score}
                  </p>
                  <p className="text-xs text-slate-500">de {mockCreditAnalysis.maxScore}</p>
                </div>
              </div>
              <div className="mt-2">
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium flex items-center gap-1 justify-center w-fit mx-auto">
                  <Star className="w-4 h-4" />
                  {mockCreditAnalysis.rating}
                </span>
              </div>
            </div>

            {/* Detalhes do Crédito */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">Limite Total</span>
                <span className="font-medium text-slate-900">{formatCurrency(mockCreditAnalysis.creditLimit)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">Limite Usado</span>
                <span className="font-medium text-red-600">{formatCurrency(mockCreditAnalysis.usedLimit)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">Limite Disponível</span>
                <span className="font-medium text-green-600">{formatCurrency(mockCreditAnalysis.availableLimit)}</span>
              </div>
              
              {/* Barra de uso */}
              <div className="mt-2">
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-purple-500 rounded-full"
                    style={{ width: `${(mockCreditAnalysis.usedLimit / mockCreditAnalysis.creditLimit) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1 text-right">
                  {((mockCreditAnalysis.usedLimit / mockCreditAnalysis.creditLimit) * 100).toFixed(1)}% utilizado
                </p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>{mockCreditAnalysis.paymentHistory}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                <Shield className="w-4 h-4 text-blue-500" />
                <span>Conta ativa há {mockCreditAnalysis.accountAge}</span>
              </div>
            </div>
          </div>

          {/* Recomendações */}
          <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl border border-purple-100 p-6">
            <h3 className="text-lg font-semibold text-purple-900 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-purple-600" />
              Dicas para seu Score
            </h3>
            <ul className="space-y-3">
              {mockCreditAnalysis.recommendations.map((rec, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-purple-800">
                  <CheckCircle className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Ações */}
          <div className="space-y-3">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Sair da Conta
            </button>
          </div>
        </div>
      </div>

      {/* Botão de voltar */}
      <div className="mt-6">
        <Button 
          variant="secondary" 
          onClick={() => navigate('/dashboard')}
          className="text-slate-600"
        >
          ← Voltar ao Dashboard
        </Button>
      </div>
    </div>
  );
};

export default ProfilePage;
