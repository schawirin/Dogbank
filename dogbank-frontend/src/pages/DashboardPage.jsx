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
        // 1) tenta pegar do contexto
        let chave = user?.cpf;
        // 2) se não existir, tenta do localStorage
        if (!chave) {
          chave = localStorage.getItem('cpf');
        }
        if (!chave) {
          throw new Error('CPF não encontrado no contexto do usuário');
        }

        // 3) chama o serviço de conta
        const acct = await accountService.getAccountInfo(chave);
        setAccountData(acct);

        // 4) chama o serviço de histórico (se tiver id)
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
      <div className="flex justify-center items-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4" />
          <p className="text-neutral-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-800">
          Olá, {user?.nome || 'Cliente'}
        </h1>
        <p className="text-neutral-500">Bem-vindo ao seu painel do DogBank</p>
      </div>

      {error && (
        <Alert
          type="error"
          message={error}
          onClose={() => setError('')}
          className="mb-6"
        />
      )}

      <div className="mb-6">
        <AccountSummary accountData={accountData} />
      </div>

      <div className="mb-6">
        <QuickActions />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-7">
          <TransactionHistory transactions={transactions.slice(0, 5)} />
        </div>

        <div className="md:col-span-5">
          <Card title="Meus cartões" className="mb-6">
            <div className="py-4 px-2 text-center text-neutral-500">
              <p>Você ainda não possui cartões.</p>
              <button
                onClick={() => navigate('/cartoes')}
                className="text-primary-500 text-sm font-medium hover:text-primary-600 mt-2 inline-block transition-colors cursor-pointer"
              >
                Solicitar cartão
              </button>
            </div>
          </Card>

          <Card title="Dicas financeiras">
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-1">
                  Economize com PIX
                </h4>
                <p className="text-sm text-blue-600">
                  Fazer transferências via PIX é gratuito e instantâneo, 24h por dia.
                </p>
              </div>

              <div className="p-3 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-800 mb-1">
                  Reserve uma parte do seu salário
                </h4>
                <p className="text-sm text-green-600">
                  Procure guardar pelo menos 10% do seu salário todo mês.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;