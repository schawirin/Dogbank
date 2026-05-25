import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import accountService from '../services/accountService';
import pixService from '../services/pixService';
import Alert from '../components/common/Alert';
import { Zap, FileText, ArrowRight, Activity, CreditCard, ChevronRight } from 'lucide-react';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value ?? 0);

const formatDate = (raw) => {
  if (!raw) return '';
  try {
    const d = new Date(raw);
    return d.toLocaleDateString('pt-BR');
  } catch {
    return '';
  }
};

function TransactionItem({ tx, currentAccountId }) {
  const isPositive = tx.accountDestinationId === currentAccountId;
  const name = isPositive
    ? (tx.senderName || tx.origem || 'Recebimento')
    : (tx.receiverName || tx.destinatario || 'Transferência');
  return (
    <div className="flex items-center justify-between p-4 rounded-2xl hover:bg-white/50 transition-colors border border-transparent hover:border-slate-100 cursor-pointer">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          isPositive ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-600'
        }`}>
          <ArrowRight className={`w-4 h-4 transform ${isPositive ? 'rotate-90' : '-rotate-45'}`} />
        </div>
        <div>
          <p className="font-semibold text-slate-800 text-sm">{name}</p>
          <p className="text-xs text-slate-400">{formatDate(tx.completedAt || tx.startedAt || tx.data)}</p>
        </div>
      </div>
      <p className={`font-bold text-sm ${isPositive ? 'text-green-500' : 'text-slate-800'}`}>
        {isPositive ? '+ ' : '- '}{formatCurrency(Math.abs(tx.amount || 0))}
      </p>
    </div>
  );
}

const DashboardPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [accountData, setAccountData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        let chave = user?.cpf;
        if (!chave) chave = localStorage.getItem('cpf');
        if (!chave) throw new Error('CPF não encontrado no contexto do usuário');

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

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-200 rounded-full animate-spin border-t-purple-600 mx-auto mb-6" />
          <p className="text-slate-600 font-medium">Carregando seus dados...</p>
        </div>
      </div>
    );
  }

  const recentTx = transactions.slice(0, 5);
  const userFirstName = user?.nome?.split(' ')[0] || 'Cliente';
  const userInitial = (user?.nome || 'C').charAt(0).toUpperCase();

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex items-center gap-4 animate-slide-up">
        <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-purple-500/25">
          {userInitial}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {getGreeting()}, {userFirstName}
          </h1>
          <p className="text-slate-500 text-sm">Bem-vindo ao seu painel do DogBank</p>
        </div>
      </div>

      {error && (
        <Alert
          type="error"
          message={error}
          onClose={() => setError('')}
        />
      )}

      {/* Balance + Credit Card */}
      <div className="flex flex-col md:flex-row gap-6 animate-slide-up stagger-1">
        {/* Balance Card */}
        <div className="glass-panel p-8 rounded-3xl flex-1 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 transform group-hover:scale-110 transition-transform duration-700 pointer-events-none">
            <Zap className="w-32 h-32" />
          </div>

          <p className="text-sm font-medium text-slate-500 mb-2 flex items-center gap-2">
            Saldo disponível <Activity className="w-4 h-4 text-green-500" />
          </p>
          <div className="flex items-end gap-3 mb-6">
            <h2 className="text-4xl md:text-5xl font-extrabold text-slate-800 tracking-tight">
              {formatCurrency(accountData?.balance ?? accountData?.saldo)}
            </h2>
          </div>
          {accountData?.accountNumber && (
            <p className="text-xs text-slate-400 mb-6">Conta {accountData.accountNumber}</p>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => navigate('/dashboard/pix')}
              className="bg-slate-900 hover:bg-purple-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 flex items-center gap-2 shadow-lg shadow-slate-900/20 hover:shadow-purple-600/30 hover:-translate-y-0.5"
            >
              <Zap className="w-4 h-4" /> Fazer PIX
            </button>
            <button
              onClick={() => navigate('/dashboard/extrato')}
              className="bg-white hover:bg-slate-50 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 border border-slate-200 flex items-center gap-2 hover:-translate-y-0.5 shadow-sm"
            >
              <FileText className="w-4 h-4" /> Ver extrato
            </button>
          </div>
        </div>

        {/* Credit Card */}
        <div
          onClick={() => navigate('/dashboard/cartoes')}
          className="w-full md:w-80 h-48 rounded-3xl card-gradient shadow-xl shadow-purple-600/20 p-6 flex flex-col justify-between text-white animate-slide-up stagger-2 transform hover:-translate-y-2 transition-transform duration-300 cursor-pointer"
        >
          <div className="flex justify-between items-start">
            <span className="font-bold text-lg tracking-wider opacity-90">DogBank</span>
            <span className="text-xs font-medium uppercase tracking-wider opacity-80">Mastercard</span>
          </div>
          <div>
            <div className="w-9 h-6 rounded bg-yellow-300/80 mb-3" />
            <div className="flex gap-2 mb-2">
              <span className="text-lg tracking-[0.2em] font-mono text-white/90">••••</span>
              <span className="text-lg tracking-[0.2em] font-mono text-white/90">••••</span>
              <span className="text-lg tracking-[0.2em] font-mono text-white/90">••••</span>
              <span className="text-lg tracking-[0.2em] font-mono text-white/90">1234</span>
            </div>
            <div className="flex justify-between items-end text-[10px] font-medium opacity-80 uppercase tracking-wider">
              <div>
                <div>Portador</div>
                <div className="text-xs not-italic">{(user?.nome || 'CLIENTE').toUpperCase()}</div>
              </div>
              <div className="text-right">
                <div>Válido</div>
                <div className="text-xs">12/28</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions + Invoice */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-up stagger-3">
        {/* Latest Transactions */}
        <div className="lg:col-span-2 glass-panel rounded-3xl p-6 md:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800">Últimas transações</h3>
            <button
              onClick={() => navigate('/dashboard/extrato')}
              className="text-sm font-medium text-purple-600 hover:text-purple-800 inline-flex items-center gap-1"
            >
              Ver todas <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {recentTx.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              Nenhuma transação encontrada ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {recentTx.map((tx) => (
                <TransactionItem key={tx.id} tx={tx} currentAccountId={accountData?.id} />
              ))}
            </div>
          )}
        </div>

        {/* Invoice / Card Summary */}
        <div className="glass-panel rounded-3xl p-6 md:p-8 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Resumo da fatura</h3>
            </div>

            <div className="mb-6">
              <p className="text-sm text-slate-500 mb-1">Fatura atual</p>
              <p className="text-3xl font-bold text-red-500">R$ 1.750,00</p>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
                <div className="bg-red-500 h-1.5 rounded-full" style={{ width: '45%' }} />
              </div>
            </div>

            <div>
              <p className="text-sm text-slate-500 mb-1">Limite disponível</p>
              <p className="text-xl font-bold text-green-500">R$ 3.250,00</p>
            </div>
          </div>

          <button
            onClick={() => navigate('/dashboard/cartoes')}
            className="w-full mt-8 bg-purple-100 text-purple-700 hover:bg-purple-200 py-3 rounded-xl font-semibold transition-colors"
          >
            Pagar fatura
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
