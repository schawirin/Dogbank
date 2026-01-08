import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import accountService from '../services/accountService';
import pixService from '../services/pixService';
import AccountSummary from '../components/dashboard/AccountSummary';
import TransactionHistory from '../components/dashboard/TransactionHistory';
import QuickActions from '../components/dashboard/QuickActions';
import Card from '../components/common/Card';
import Alert from '../components/common/Alert';
import { CreditCard, Lightbulb, TrendingUp, PiggyBank } from 'lucide-react';

const DashboardPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [accountData, setAccountData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    if (!authLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        let chave = user?.cpf;
        if (!chave) {
          chave = localStorage.getItem('cpf');
        }
        if (!chave) {
          throw new Error('CPF não encontrado no contexto do usuário');
        }

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
          <div className="relative">
            <div className="w-16 h-16 border-4 border-purple-200 rounded-full animate-spin border-t-purple-600 mx-auto mb-6" />
          </div>
          <p className="text-slate-600 font-medium">Carregando seus dados...</p>
        </div>
      </div>
    );
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  return (
    <div className={`py-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-purple-500/25">
            {(user?.nome || 'C').charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {getGreeting()}, {user?.nome?.split(' ')[0] || 'Cliente'}
            </h1>
            <p className="text-slate-500">Bem-vindo ao seu painel do DogBank</p>
          </div>
        </div>
      </div>

      {error && (
        <Alert
          type="error"
          message={error}
          onClose={() => setError('')}
          className="mb-6"
        />
      )}

      {/* Account Summary */}
      <div className="mb-8">
        <AccountSummary accountData={accountData} />
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <QuickActions />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Transaction History */}
        <div className="lg:col-span-7">
          <TransactionHistory transactions={transactions.slice(0, 5)} />
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-5 space-y-6">
          {/* Cards Section */}
          <Card 
            variant="default"
            className="overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Meus cartões</h3>
              </div>
              
              {/* Mini Card Preview */}
              <div className="mb-4">
                <div 
                  className="relative h-36 rounded-xl p-4 text-white shadow-lg cursor-pointer hover:scale-[1.02] transition-transform"
                  style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                  onClick={() => navigate('/dashboard/cartoes')}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="text-xs font-bold opacity-90">DogBank</div>
                    <div className="text-xs opacity-70">Mastercard</div>
                  </div>
                  <div className="w-8 h-5 bg-yellow-300 rounded opacity-80 mb-3"></div>
                  <div className="text-sm font-mono tracking-wider mb-2">**** **** **** 1234</div>
                  <div className="flex justify-between items-end text-xs">
                    <div>
                      <div className="opacity-60">PORTADOR</div>
                      <div className="font-medium">{(user?.nome || 'CLIENTE DOGBANK').toUpperCase()}</div>
                    </div>
                    <div className="text-right">
                      <div className="opacity-60">VÁLIDO</div>
                      <div className="font-medium">12/28</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Info Summary */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500">Limite disponível</p>
                  <p className="text-sm font-bold text-green-600">R$ 3.250,00</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500">Fatura atual</p>
                  <p className="text-sm font-bold text-red-600">R$ 1.750,00</p>
                </div>
              </div>

              <button
                onClick={() => navigate('/dashboard/cartoes')}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-medium text-sm hover:from-violet-500 hover:to-purple-500 transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40"
              >
                Consultar cartões
              </button>
            </div>
          </Card>

          {/* Tips Section */}
          <Card variant="default">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center">
                  <Lightbulb className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Dicas financeiras</h3>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-blue-900 mb-1">
                        Economize com PIX
                      </h4>
                      <p className="text-sm text-blue-700/80">
                        Transferências via PIX são gratuitas e instantâneas, 24h por dia.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-2xl border border-emerald-100">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <PiggyBank className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-emerald-900 mb-1">
                        Reserve parte do salário
                      </h4>
                      <p className="text-sm text-emerald-700/80">
                        Procure guardar pelo menos 10% do seu salário todo mês.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
