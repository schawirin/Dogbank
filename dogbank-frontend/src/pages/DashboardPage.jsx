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

const DashboardPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [accountData, setAccountData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Protege a rota
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [authLoading, user, navigate]);

  // Busca dados da conta e extrato
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Buscar userId - prioridade: contexto > localStorage
        let userId = user?.id;
        if (!userId) {
          userId = localStorage.getItem('userId');
        }
        if (!userId) {
          throw new Error('ID do usuário não encontrado');
        }

        console.log('Buscando dados para userId:', userId);

        // Buscar dados da conta usando userId
        const acct = await accountService.getAccountInfo(userId);
        setAccountData(acct);

        // Buscar histórico de transações
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

    if (user || localStorage.getItem('userId')) {
      fetchData();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-center animate-fade-in">
          <div className="animate-spin rounded-full h-14 w-14 border-4 border-primary-200 border-t-primary-500 mx-auto mb-4" />
          <p className="text-neutral-600 font-medium">Carregando seus dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-800 font-display mb-2 animate-fade-in-down">
          Olá, <span className="text-gradient">{user?.nome || 'Cliente'}</span>
        </h1>
        <p className="text-neutral-500 text-lg animate-fade-in-down delay-100">
          Bem-vindo ao seu painel do DogBank
        </p>
      </div>

      {error && (
        <Alert
          type="error"
          message={error}
          onClose={() => setError('')}
          className="mb-6 animate-shake"
        />
      )}

      <div className="mb-8 animate-fade-in-up delay-200">
        <AccountSummary accountData={accountData} />
      </div>

      <div className="mb-8 animate-fade-in-up delay-300">
        <QuickActions />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-7 animate-fade-in-left delay-400">
          <TransactionHistory transactions={transactions.slice(0, 5)} />
        </div>

        <div className="md:col-span-5 space-y-6 animate-fade-in-right delay-400">
          <Card title="Meus cartões" hoverable gradient className="hover-scale">
            <div className="py-4 px-2 text-center text-neutral-500">
              <div className="text-5xl mb-3">💳</div>
              <p className="mb-3">Você ainda não possui cartões.</p>
              <button
                onClick={() => navigate('/app/cartoes')}
                className="text-primary-500 text-sm font-semibold hover:text-primary-600 transition-smooth px-4 py-2 rounded-lg hover:bg-primary-50"
              >
                Solicitar cartão →
              </button>
            </div>
          </Card>

          <Card title="Dicas financeiras" gradient>
            <div className="space-y-3">
              <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl hover-lift transition-smooth">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">💰</div>
                  <div>
                    <h4 className="font-semibold text-blue-800 mb-1">
                      Economize com PIX
                    </h4>
                    <p className="text-sm text-blue-600 leading-relaxed">
                      Fazer transferências via PIX é gratuito e instantâneo, 24h por dia.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl hover-lift transition-smooth">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">🎯</div>
                  <div>
                    <h4 className="font-semibold text-green-800 mb-1">
                      Reserve uma parte do seu salário
                    </h4>
                    <p className="text-sm text-green-600 leading-relaxed">
                      Procure guardar pelo menos 10% do seu salário todo mês.
                    </p>
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