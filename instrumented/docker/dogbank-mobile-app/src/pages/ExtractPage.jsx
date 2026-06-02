// src/pages/ExtractPage.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import accountService from '../services/accountService';
import pixService from '../services/pixService';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Alert from '../components/common/Alert';
import { ArrowUpRight, ArrowDownLeft, Building2, Clock, CheckCircle, Copy, Download, Printer, Filter, Calendar, ChevronDown, ChevronUp } from 'lucide-react';

const ExtractPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [accountData, setAccountData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('30');
  const [filterType, setFilterType] = useState('all');
  const [expandedTransaction, setExpandedTransaction] = useState(null);

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

  // Calcular totais
  const totals = filteredTransactions.reduce((acc, t) => {
    const amount = parseFloat(t.valor || t.amount || 0);
    if (t.tipo === 'enviado') {
      acc.sent += amount;
    } else {
      acc.received += amount;
    }
    return acc;
  }, { sent: 0, received: 0 });

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

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatFullDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    const csvContent = [
      'Data,Hora,Tipo,Valor,De,Para,Instituição,Chave PIX,ID Transação',
      ...filteredTransactions.map(t => {
        const date = t.data || t.createdAt || t.completedAt;
        return `${formatDate(date)},${formatTime(date)},${t.tipo},${t.valor || t.amount},${t.senderName || t.origem || 'N/A'},${t.receiverName || t.destinatario || 'N/A'},${t.receiverBank || t.senderBank || 'DogBank'},${t.pixKey || 'N/A'},${t.id || 'N/A'}`;
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `extrato_dogbank_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const toggleExpand = (id) => {
    setExpandedTransaction(expandedTransaction === id ? null : id);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4" />
          <p className="text-slate-600">Carregando extrato...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6 max-w-5xl mx-auto">
      {/* Cabeçalho */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-1">
              Extrato Bancário
            </h1>
            <p className="text-slate-500">
              {user?.nome || 'Cliente'} • Conta {accountData?.numero_conta || accountData?.accountNumber || '000000-0'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 text-white bg-purple-600 rounded-xl hover:bg-purple-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
          </div>
        </div>
      </div>

      {error && (
        <Alert type="error" message={error} onClose={() => setError('')} className="mb-6" />
      )}

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500 mb-1">Saldo Atual</p>
          <p className="text-2xl font-bold text-slate-900">
            {formatCurrency(accountData?.saldo || accountData?.balance || 0)}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500 mb-1">Total Recebido</p>
          <p className="text-2xl font-bold text-green-600">
            +{formatCurrency(totals.received)}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500 mb-1">Total Enviado</p>
          <p className="text-2xl font-bold text-red-600">
            -{formatCurrency(totals.sent)}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500 mb-1">Transações</p>
          <p className="text-2xl font-bold text-slate-900">
            {filteredTransactions.length}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">Filtros:</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
            >
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
              <option value="365">Último ano</option>
            </select>
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
          >
            <option value="all">Todas as transações</option>
            <option value="sent">Apenas enviadas</option>
            <option value="received">Apenas recebidas</option>
          </select>
        </div>
      </div>

      {/* Lista de Transações */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">
            Histórico de Transações
          </h2>
          <p className="text-sm text-slate-500">
            {filteredTransactions.length} transação(ões) no período selecionado
          </p>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-500 mb-4">Nenhuma transação encontrada no período selecionado.</p>
            <Button 
              onClick={() => navigate('/dashboard/pix')}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Fazer PIX
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredTransactions.map((transaction, index) => {
              const isReceived = transaction.tipo === 'recebido';
              const amount = transaction.valor || transaction.amount;
              const date = transaction.data || transaction.createdAt || transaction.completedAt;
              const isExpanded = expandedTransaction === transaction.id;

              return (
                <div key={transaction.id || index} className="hover:bg-slate-50 transition-colors">
                  {/* Linha Principal */}
                  <div 
                    className="p-4 cursor-pointer"
                    onClick={() => toggleExpand(transaction.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {/* Ícone */}
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          isReceived ? 'bg-green-100' : 'bg-red-100'
                        }`}>
                          {isReceived ? (
                            <ArrowDownLeft className="w-6 h-6 text-green-600" />
                          ) : (
                            <ArrowUpRight className="w-6 h-6 text-red-600" />
                          )}
                        </div>

                        {/* Info Principal */}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-900">
                              {isReceived ? 'PIX Recebido' : 'PIX Enviado'}
                            </p>
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Concluído
                            </span>
                          </div>
                          <p className="text-sm text-slate-500">
                            {isReceived ? 'De: ' : 'Para: '}
                            <span className="font-medium text-slate-700">
                              {isReceived 
                                ? (transaction.senderName || transaction.origem || 'Não informado')
                                : (transaction.receiverName || transaction.destinatario || 'Não informado')
                              }
                            </span>
                          </p>
                          <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                            <Clock className="w-3 h-3" />
                            {formatFullDate(date)}
                          </p>
                        </div>
                      </div>

                      {/* Valor e Expandir */}
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className={`text-xl font-bold ${isReceived ? 'text-green-600' : 'text-red-600'}`}>
                            {isReceived ? '+' : '-'} {formatCurrency(amount)}
                          </p>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Detalhes Expandidos */}
                  {isExpanded && (
                    <div className="px-4 pb-4">
                      <div className="bg-slate-50 rounded-xl p-4 ml-16">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Remetente */}
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                              {isReceived ? 'Remetente' : 'Sua Conta'}
                            </h4>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                                  <span className="text-sm font-bold text-purple-600">
                                    {(isReceived ? transaction.senderName : user?.nome || 'U')?.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <p className="font-medium text-slate-900">
                                    {isReceived ? (transaction.senderName || transaction.origem) : (user?.nome || 'Você')}
                                  </p>
                                  <p className="text-xs text-slate-500 flex items-center gap-1">
                                    <Building2 className="w-3 h-3" />
                                    {isReceived ? (transaction.senderBank || 'DogBank') : 'DogBank'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Destinatário */}
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                              {isReceived ? 'Sua Conta' : 'Destinatário'}
                            </h4>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                  <span className="text-sm font-bold text-green-600">
                                    {(isReceived ? user?.nome : transaction.receiverName || 'D')?.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <p className="font-medium text-slate-900">
                                    {isReceived ? (user?.nome || 'Você') : (transaction.receiverName || transaction.destinatario)}
                                  </p>
                                  <p className="text-xs text-slate-500 flex items-center gap-1">
                                    <Building2 className="w-3 h-3" />
                                    {isReceived ? 'DogBank' : (transaction.receiverBank || 'DogBank')}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Informações Adicionais */}
                        <div className="mt-4 pt-4 border-t border-slate-200">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-slate-500">ID da Transação</p>
                              <div className="flex items-center gap-1">
                                <p className="font-mono font-medium text-slate-900">#{transaction.id}</p>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); copyToClipboard(transaction.id?.toString()); }}
                                  className="text-slate-400 hover:text-slate-600"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            <div>
                              <p className="text-slate-500">Chave PIX</p>
                              <div className="flex items-center gap-1">
                                <p className="font-medium text-slate-900 truncate max-w-[150px]">
                                  {transaction.pixKey || 'N/A'}
                                </p>
                                {transaction.pixKey && (
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); copyToClipboard(transaction.pixKey); }}
                                    className="text-slate-400 hover:text-slate-600"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div>
                              <p className="text-slate-500">Data</p>
                              <p className="font-medium text-slate-900">{formatDate(date)}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">Hora</p>
                              <p className="font-medium text-slate-900">{formatTime(date)}</p>
                            </div>
                          </div>
                          {transaction.description && (
                            <div className="mt-3">
                              <p className="text-slate-500 text-sm">Descrição</p>
                              <p className="font-medium text-slate-900">{transaction.description}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
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

export default ExtractPage;
