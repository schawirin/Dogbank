// src/pages/CardsPage.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Alert from '../components/common/Alert';

const CardsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showCardDetails, setShowCardDetails] = useState(false);

  // Mock data - em produção viria da API
  const cardData = {
    number: '**** **** **** 1234',
    fullNumber: '5555 1234 5678 1234',
    holder: user?.nome || 'CLIENTE DOGBANK',
    expiry: '12/28',
    cvv: '123',
    brand: 'Mastercard',
    type: 'Crédito',
    limit: 5000.00,
    availableLimit: 3250.00,
    usedLimit: 1750.00,
    invoiceAmount: 1750.00,
    invoiceDueDate: '2025-06-15',
    invoiceStatus: 'Aberta'
  };

  const recentTransactions = [
    {
      id: 1,
      description: 'Amazon.com',
      amount: 89.90,
      date: '2025-05-20T14:30:00',
      category: 'Compras Online',
      installments: '1x'
    },
    {
      id: 2,
      description: 'Uber',
      amount: 25.50,
      date: '2025-05-19T18:45:00',
      category: 'Transporte',
      installments: '1x'
    },
    {
      id: 3,
      description: 'Mercado Livre',
      amount: 156.70,
      date: '2025-05-18T10:20:00',
      category: 'Compras Online',
      installments: '3x'
    },
    {
      id: 4,
      description: 'Netflix',
      amount: 45.90,
      date: '2025-05-15T08:00:00',
      category: 'Streaming',
      installments: '1x'
    }
  ];

  // Protege a rota
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    // Simula carregamento
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getUsagePercentage = () => {
    return (cardData.usedLimit / cardData.limit) * 100;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4" />
          <p className="text-neutral-600">Carregando cartões...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-slide-up">
      {/* Cabeçalho */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">
          Meus Cartões
        </h1>
        <p className="text-sm text-slate-500">
          Gerencie seus cartões de crédito
        </p>
      </div>

      {/* Cartão Visual */}
      <div className="mb-8">
        <div className="relative">
          {/* Cartão */}
          <div className="w-full max-w-sm mx-auto">
            <div className="relative h-56 rounded-2xl p-6 text-white shadow-2xl transform hover:scale-105 transition-transform duration-300" 
                 style={{
                   background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                 }}>
              {/* Logo do banco */}
              <div className="flex justify-between items-start mb-8">
                <div className="text-lg font-bold">DogBank</div>
                <div className="text-right text-sm opacity-80">
                  {cardData.brand}
                </div>
              </div>

              {/* Chip */}
              <div className="w-12 h-8 bg-yellow-300 rounded-md mb-4 opacity-90"></div>

              {/* Número do cartão */}
              <div className="text-xl font-mono tracking-wider mb-4">
                {showCardDetails ? cardData.fullNumber : cardData.number}
              </div>

              {/* Nome e validade */}
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-xs opacity-70">PORTADOR</div>
                  <div className="text-sm font-medium">{cardData.holder}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs opacity-70">VÁLIDO ATÉ</div>
                  <div className="text-sm font-medium">{cardData.expiry}</div>
                </div>
              </div>
            </div>

            {/* Botão para mostrar/ocultar dados */}
            <div className="text-center mt-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowCardDetails(!showCardDetails)}
              >
                {showCardDetails ? '👁️ Ocultar dados' : '👁️ Ver dados do cartão'}
              </Button>
            </div>

            {/* CVV - só mostra quando detalhes estão visíveis */}
            {showCardDetails && (
              <div className="mt-4 text-center">
                <div className="inline-block bg-neutral-100 px-4 py-2 rounded-lg">
                  <span className="text-sm text-neutral-600">CVV: </span>
                  <span className="font-mono font-bold">{cardData.cvv}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Limite e Fatura */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Limite Disponível */}
        <Card>
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-4">Limite Disponível</h3>
            <div className="mb-4">
              <div className="text-3xl font-bold text-primary-600 mb-2">
                {formatCurrency(cardData.availableLimit)}
              </div>
              <p className="text-sm text-neutral-600">
                de {formatCurrency(cardData.limit)} total
              </p>
            </div>
            
            {/* Barra de progresso do limite */}
            <div className="w-full bg-neutral-200 rounded-full h-3 mb-4">
              <div 
                className="bg-gradient-to-r from-primary-500 to-primary-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${getUsagePercentage()}%` }}
              />
            </div>
            
            <div className="flex justify-between text-xs text-neutral-600">
              <span>Usado: {formatCurrency(cardData.usedLimit)}</span>
              <span>{getUsagePercentage().toFixed(1)}%</span>
            </div>
          </div>
        </Card>

        {/* Fatura Atual */}
        <Card>
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-4">Fatura Atual</h3>
            <div className="mb-4">
              <div className="text-3xl font-bold text-red-600 mb-2">
                {formatCurrency(cardData.invoiceAmount)}
              </div>
              <p className="text-sm text-neutral-600">
                Vencimento: {formatDate(cardData.invoiceDueDate)}
              </p>
            </div>
            
            {/* Status da fatura */}
            <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800 mb-4">
              🟡 {cardData.invoiceStatus}
            </div>
            
            <div className="space-y-2">
              <Button size="sm" className="w-full">
                Pagar Fatura
              </Button>
              <Button variant="secondary" size="sm" className="w-full">
                Ver Fatura Completa
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Ações Rápidas */}
      <Card className="mb-6">
        <h3 className="text-lg font-semibold mb-4">Ações Rápidas</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Button variant="secondary" size="sm">
            🔒 Bloquear
          </Button>
          <Button variant="secondary" size="sm">
            📱 2ª Via
          </Button>
          <Button variant="secondary" size="sm">
            📊 Limite
          </Button>
          <Button variant="secondary" size="sm">
            ⚙️ Configurar
          </Button>
        </div>
      </Card>

      {/* Últimas Transações */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Últimas Transações</h3>
          <Button variant="secondary" size="sm">
            Ver todas
          </Button>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-neutral-500">Nenhuma transação recente</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-600 font-semibold">
                      {transaction.description.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-neutral-800">
                      {transaction.description}
                    </p>
                    <p className="text-sm text-neutral-600">
                      {formatDate(transaction.date)} • {transaction.category}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-red-600">
                    - {formatCurrency(transaction.amount)}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {transaction.installments}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Botão de voltar */}
      <div className="mt-6">
        <Button 
          variant="secondary" 
          onClick={() => navigate('/dashboard')}
        >
          ← Voltar ao Dashboard
        </Button>
      </div>
    </div>
  );
};

export default CardsPage;