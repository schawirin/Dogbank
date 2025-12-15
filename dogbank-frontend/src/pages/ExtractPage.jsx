// src/pages/ExtractPage.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import accountService from '../services/accountService';
import pixService from '../services/pixService';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Alert from '../components/common/Alert';

const ExtractPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [accountData, setAccountData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('30');
  const [filterType, setFilterType] = useState('all');

  // Protege a rota
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [authLoading, user, navigate]);

  // Busca dados da conta e transações
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        let chave = user?.cpf || localStorage.getItem('cpf');
        if (!chave) throw new Error('CPF não encontrado');

        const acct = await accountService.getAccountInfo(chave);
        setAccountData(acct);

        if (acct?.id) {
          const hx = await pixService.getTransactionHistory(acct.id);
          setTransactions(hx || []);
        }
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

  // Filtrar transações
  const filteredTransactions = transactions.filter(transaction => {
    if (filterType === 'sent' && transaction.tipo !== 'enviado') return false;
    if (filterType === 'received' && transaction.tipo !== 'recebido') return false;

    const transactionDate = new Date(transaction.data || transaction.createdAt || transaction.completedAt);
    const now = new Date();
    const daysAgo = new Date(now.getTime() - (parseInt(filterPeriod) * 24 * 60 * 60 * 1000));
    
    return transactionDate >= daysAgo;
  });

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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTransactionIcon = (tipo) => {
    switch (tipo) {
      case 'enviado':
        return '↗️';
      case 'recebido':
        return '↙️';
      default:
        return '💰';
    }
  };

  const getTransactionColor = (tipo) => {
    switch (tipo) {
      case 'enviado':
        return 'text-red-600';
      case 'recebido':
        return 'text-green-600';
      default:
        return 'text-neutral-600';
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    const csvContent = [
      'Data,Tipo,Valor,Destinatário/Origem,Descrição',
      ...filteredTransactions.map(t => 
        `${formatDate(t.data || t.createdAt || t.completedAt)},${t.tipo},${t.valor || t.amount},${t.destinatario || t.origem || t.receiverName || t.senderName || 'N/A'},"${t.descricao || t.description || ''}"`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `extrato_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4" />
          <p className="text-neutral-600">Carregando extrato...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      {/* Cabeçalho */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-800">
          Extrato da Conta
        </h1>
        <p className="text-neutral-500">
          {user?.nome || 'Cliente'} • {accountData?.numero_conta || accountData?.accountNumber}
        </p>
      </div>

      {error && (
        <Alert type="error" message={error} onClose={() => setError('')} className="mb-6" />
      )}

      {/* Resumo da conta */}
      {accountData && (
        <Card className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-sm text-neutral-600">Saldo Atual</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(accountData.saldo || accountData.balance)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-neutral-600">Agência</p>
              <p className="text-lg font-medium">
                {accountData.agencia || accountData.branch || '0001'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-neutral-600">Conta</p>
              <p className="text-lg font-medium">
                {accountData.numero_conta || accountData.accountNumber}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Filtros e Ações */}
      <Card className="mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Período
              </label>
              <select
                value={filterPeriod}
                onChange={(e) => setFilterPeriod(e.target.value)}
                className="border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="7">Últimos 7 dias</option>
                <option value="30">Últimos 30 dias</option>
                <option value="90">Últimos 90 dias</option>
                <option value="365">Último ano</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Tipo
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">Todas</option>
                <option value="sent">Enviadas</option>
                <option value="received">Recebidas</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={handlePrint}>
              🖨️ Imprimir
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExport}>
              📥 Exportar CSV
            </Button>
          </div>
        </div>
      </Card>

      {/* Lista de Transações */}
      <Card>
        <div className="mb-4">
          <h2 className="text-lg font-semibold">
            Histórico de Transações
          </h2>
          <p className="text-sm text-neutral-600">
            {filteredTransactions.length} transação(ões) encontrada(s)
          </p>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-neutral-500">Nenhuma transação encontrada no período selecionado.</p>
            <Button 
              onClick={() => navigate('/app/pix')}
              className="mt-4"
            >
              Fazer PIX
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTransactions.map((transaction, index) => {
              const isReceived = transaction.tipo === 'recebido';
              const amount = transaction.valor || transaction.amount;
              const date = transaction.data || transaction.createdAt || transaction.completedAt;
              const counterpart = isReceived 
                ? (transaction.origem || transaction.senderName) 
                : (transaction.destinatario || transaction.receiverName);
              const description = transaction.descricao || transaction.description;

              return (
                <div
                  key={transaction.id || index}
                  className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">
                      {getTransactionIcon(transaction.tipo)}
                    </div>
                    <div>
                      <p className="font-medium text-neutral-800">
                        {counterpart || 'Não informado'}
                      </p>
                      <p className="text-sm text-neutral-600">
                        {formatDate(date)}
                      </p>
                      {description && (
                        <p className="text-xs text-neutral-500">
                          {description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${getTransactionColor(transaction.tipo)}`}>
                      {isReceived ? '+' : '-'} {formatCurrency(amount)}
                    </p>
                    <p className="text-xs text-neutral-500 uppercase">
                      {transaction.tipo}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Botão de voltar */}
      <div className="mt-6">
        <Button 
          variant="secondary" 
          onClick={() => navigate('/app/dashboard')}
        >
          ← Voltar ao Dashboard
        </Button>
      </div>
    </div>
  );
};

export default ExtractPage;