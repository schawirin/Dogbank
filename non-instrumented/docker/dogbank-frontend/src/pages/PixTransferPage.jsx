// src/pages/PixTransferPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import accountService from '../services/accountService';
import pixService from '../services/pixService';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Alert from '../components/common/Alert';

const PixTransferPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  /* ------------ STATE ------------ */
  const [pixKey, setPixKey] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  // erros & loading
  const [pixKeyError, setPixKeyError] = useState('');
  const [amountError, setAmountError] = useState('');
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);
  const [validatingKey, setValidatingKey] = useState(false);

  // dados auxiliares
  const [accountData, setAccountData] = useState(null);
  const [recipientInfo, setRecipientInfo] = useState(null);

  /* ------------ EFFECT: carregar saldo ------------ */
  useEffect(() => {
    const loadAccount = async () => {
      try {
        // Tenta pegar CPF do contexto ou do localStorage
        const cpf = user?.cpf || localStorage.getItem('cpf');
        if (cpf) {
          const data = await accountService.getAccountInfo(cpf);
          setAccountData(data);
        }
      } catch (err) {
        console.error(err);
        setGeneralError(
          'Não foi possível carregar os dados da conta. Tente novamente mais tarde.',
        );
      }
    };
    loadAccount();
  }, [user]);

  /* ------------ VALIDADORES ------------ */
  const validateAmount = () => {
    const numeric = parseFloat(amount.replace(/\./g, '').replace(',', '.'));
    if (!amount.trim() || Number.isNaN(numeric) || numeric <= 0) {
      setAmountError('Digite um valor válido e maior que zero');
      return false;
    }
    if (accountData && numeric > accountData.saldo) {
      setAmountError('Saldo insuficiente');
      return false;
    }
    setAmountError('');
    return true;
  };

  const validatePixKey = async () => {
    if (!pixKey.trim()) {
      setPixKeyError('Digite uma chave PIX');
      return false;
    }
    try {
      setValidatingKey(true);
      const result = await pixService.validatePixKey(pixKey.trim());

      if (result.valid) {
        setRecipientInfo(result.user ?? { nome: 'Destinatário', banco: '' });
        setPixKeyError('');
        return true;
      }

      setPixKeyError(result.error || 'Chave PIX inválida');
      return false;
    } catch (err) {
      console.error(err);
      setPixKeyError('Erro na validação da chave PIX');
      return false;
    } finally {
      setValidatingKey(false);
    }
  };

  /* ------------ HANDLERS ------------ */
  const handleAmountChange = (e) => {
    const raw = e.target.value.replace(/[^\d,.]/g, '');
    const parts = raw.split(/[,.]/);
    if (parts.length === 1) {
      setAmount(parts[0]);
    } else {
      const integer = parts[0];
      const decimal = parts.slice(1).join('').slice(0, 2);
      setAmount(`${integer},${decimal}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');

    const amountOk = validateAmount();
    const keyOk = await validatePixKey();
    if (!amountOk || !keyOk) return;

    const numericAmount = parseFloat(amount.replace(/\./g, '').replace(',', '.'));

    // ✅ CORREÇÃO: Usar rota relativa para funcionar dentro do MainLayout
    navigate('/dashboard/pix/confirm', {
      state: {
        pixKey,
        amount: numericAmount.toFixed(2),
        description: description.trim(),
        receiverName: recipientInfo?.nome || '',
        receiverBank: recipientInfo?.banco || '',
        sourceAccountId: accountData?.id,
      },
    });
  };

  const handleQuickAmount = (value) => {
    setAmount(value.toString());
    setAmountError('');
  };

  /* ------------ UTILS ------------ */
  const formatCurrency = (val) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const getPixKeyPlaceholder = () => {
    if (pixKey.includes('@')) return 'Digite o e-mail PIX';
    if (pixKey.match(/^\d/)) return 'Digite o CPF ou telefone';
    return 'CPF, e-mail, telefone ou chave aleatória';
  };

  /* ------------ RENDER ------------ */
  return (
    <div className="py-6">
      {/* Header moderno */}
      <div className="mb-8">
        <button 
          onClick={() => navigate('/dashboard')}
          className="flex items-center text-primary-600 hover:text-primary-700 mb-4 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Voltar
        </button>
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">PIX</h1>
        <p className="text-neutral-600">Envie dinheiro de forma rápida e segura</p>
      </div>

      {generalError && (
        <Alert
          type="error"
          message={generalError}
          onClose={() => setGeneralError('')}
          className="mb-6"
        />
      )}

      {/* Saldo disponível - Card destacado */}
      {accountData && (
        <div className="mb-8 p-6 bg-gradient-to-r from-primary-500 to-primary-600 rounded-2xl text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-100 text-sm font-medium">Saldo disponível</p>
              <p className="text-2xl font-bold">
                {formatCurrency(accountData.saldo)}
              </p>
            </div>
            <div className="text-4xl opacity-80">💰</div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Chave PIX - Input moderno */}
        <div>
          <label className="block text-lg font-semibold text-neutral-900 mb-3">
            Para quem você quer enviar?
          </label>
          <div className="relative">
            <input
              type="text"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder={getPixKeyPlaceholder()}
              className={`w-full px-6 py-5 text-lg border-2 rounded-2xl bg-white focus:outline-none transition-all duration-200 ${
                pixKeyError 
                  ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-100' 
                  : 'border-neutral-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-100'
              }`}
              disabled={loading || validatingKey}
            />
            {validatingKey && (
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-500 border-t-transparent"></div>
              </div>
            )}
          </div>
          
          {validatingKey && (
            <p className="text-sm text-primary-600 mt-3 flex items-center">
              <div className="animate-pulse mr-2">⏳</div>
              Validando chave PIX...
            </p>
          )}
          {pixKeyError && (
            <p className="text-sm text-red-600 mt-3 flex items-center">
              <span className="mr-2">❌</span>
              {pixKeyError}
            </p>
          )}

          {/* Info do destinatário - Card de sucesso */}
          {recipientInfo && !pixKeyError && (
            <div className="mt-4 p-4 bg-green-50 border-2 border-green-200 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 text-xl">✓</span>
                </div>
                <div>
                  <p className="font-semibold text-green-900">{recipientInfo.nome}</p>
                  {recipientInfo.banco && (
                    <p className="text-sm text-green-700">{recipientInfo.banco}</p>
                  )}
                  <p className="text-xs text-green-600 font-medium">Chave PIX válida</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Valor - Input destacado */}
        <div>
          <label className="block text-lg font-semibold text-neutral-900 mb-3">
            Quanto você quer enviar?
          </label>
          <div className="relative">
            <div className="absolute left-6 top-1/2 transform -translate-y-1/2 text-2xl text-neutral-500 font-bold">
              R$
            </div>
            <input
              type="text"
              value={amount}
              onChange={handleAmountChange}
              placeholder="0,00"
              className={`w-full pl-20 pr-6 py-5 text-3xl font-bold border-2 rounded-2xl bg-white focus:outline-none transition-all duration-200 ${
                amountError 
                  ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-100' 
                  : 'border-neutral-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-100'
              }`}
              disabled={loading}
            />
          </div>
          {amountError && (
            <p className="text-sm text-red-600 mt-3 flex items-center">
              <span className="mr-2">❌</span>
              {amountError}
            </p>
          )}

          {/* Valores rápidos */}
          <div className="mt-4">
            <p className="text-sm font-medium text-neutral-700 mb-3">Valores rápidos</p>
            <div className="flex gap-3 flex-wrap">
              {[10, 20, 50, 100, 200, 500].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleQuickAmount(value)}
                  className="px-4 py-2 text-sm font-semibold border-2 border-neutral-200 rounded-xl hover:bg-primary-50 hover:border-primary-300 active:bg-primary-100 transition-all duration-200"
                >
                  R$ {value}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Descrição - Input clean */}
        <div>
          <label className="block text-lg font-semibold text-neutral-900 mb-3">
            Descrição (opcional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Pagamento do aluguel, presente, etc."
            className="w-full px-6 py-4 text-lg border-2 border-neutral-200 rounded-2xl bg-white focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition-all duration-200"
            disabled={loading}
          />
          <p className="text-sm text-neutral-500 mt-2">
            Esta informação aparecerá no comprovante
          </p>
        </div>

        {/* Botão continuar - Destaque total */}
        <div className="pt-6">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            disabled={loading || validatingKey || !pixKey.trim() || !amount.trim()}
            className="py-5 text-xl font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent mr-3"></div>
                Processando...
              </div>
            ) : (
              'Continuar'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default PixTransferPage;
