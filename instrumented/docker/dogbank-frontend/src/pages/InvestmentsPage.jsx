import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bitcoin,
  CheckCircle2,
  Clock3,
  Landmark,
  Percent,
  PlusCircle,
  RefreshCw,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { datadogRum } from '@datadog/browser-rum';
import { useAuth } from '../hooks/useAuth';
import accountService from '../services/accountService';
import authService from '../services/authService';
import investmentService from '../services/investmentService';
import Alert from '../components/common/Alert';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import { formatCurrency } from '../utils/formatters';

const formatPercent = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '--';
  return `${(numeric * 100).toFixed(2)}%`;
};

const formatDateTime = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const numeric = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const defaultAmountFor = (productCode) => (productCode === 'BTC' ? 50000 : 1000000);

const positionLabel = (count) => (count === 1 ? 'posição' : 'posições');

const productIcon = (code) => {
  if (code === 'BTC') return Bitcoin;
  return Percent;
};

const yieldFor = (position) => numeric(position.currentValue) - numeric(position.principalAmount);

const StatCard = ({ icon: Icon, label, value, helper, tone = 'purple' }) => {
  const colors = {
    purple: 'bg-violet-50 text-violet-700',
    green: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-sky-50 text-sky-700',
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[tone]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <p className="text-sm font-semibold text-slate-500">{label}</p>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {helper && <p className="text-xs text-slate-500 mt-1">{helper}</p>}
    </div>
  );
};

const ProductCard = ({ product, amount, disabled, onAmountChange, onSubscribe }) => {
  const Icon = productIcon(product.code);
  const isBitcoin = product.code === 'BTC';

  return (
    <Card className="h-full" bodyClassName="h-full flex flex-col">
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
          isBitcoin ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
        }`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-lg font-bold text-slate-900">{product.name}</h3>
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
              {product.riskLevel}
            </span>
          </div>
          <p className="text-sm text-slate-500 leading-relaxed">{product.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 my-5">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-500 mb-1">{isBitcoin ? 'Cotação atual' : 'Taxa anual'}</p>
          <p className="text-sm font-bold text-slate-900">
            {isBitcoin ? formatCurrency(numeric(product.referencePrice)) : formatPercent(product.annualRate)}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-500 mb-1">Categoria</p>
          <p className="text-sm font-bold text-slate-900 truncate">
            {isBitcoin ? 'Ativo digital' : 'Renda fixa'}
          </p>
        </div>
      </div>

      <div className="mt-auto space-y-3">
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">Valor do aporte</span>
          <input
            type="number"
            min="1"
            step="1000"
            value={amount}
            onChange={(event) => onAmountChange(product.code, event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
          />
        </label>
        <Button
          fullWidth
          size="sm"
          disabled={disabled}
          loading={disabled}
          icon={<PlusCircle className="w-4 h-4" />}
          onClick={() => onSubscribe(product)}
        >
          {isBitcoin ? 'Aplicar Bitcoin' : 'Aplicar 100% CDI'}
        </Button>
      </div>
    </Card>
  );
};

const MetricRow = ({ label, value, valueClassName = 'text-slate-900' }) => (
  <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
    <span className="text-sm text-slate-500">{label}</span>
    <span className={`text-sm font-bold text-right ${valueClassName}`}>{value}</span>
  </div>
);

const PositionCard = ({ position, syncing, onSync }) => {
  const accumulatedYield = yieldFor(position);
  const protocol = position.registryProtocol || position.auditCorrelationId || '--';

  return (
    <Card bodyClassName="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-lg font-bold text-slate-900">{position.productName}</h3>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Ativo
            </span>
          </div>
          <p className="text-xs text-slate-500">Contrato {position.positionId}</p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          loading={syncing}
          disabled={syncing}
          icon={<RefreshCw className="w-4 h-4" />}
          onClick={() => onSync(position)}
        >
          Atualizar valor
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
        <div>
          <MetricRow label="Valor aplicado" value={formatCurrency(numeric(position.principalAmount))} />
          <MetricRow label="Saldo atual" value={formatCurrency(numeric(position.currentValue))} />
          <MetricRow
            label="Rendimento acumulado"
            value={formatCurrency(accumulatedYield)}
            valueClassName={accumulatedYield >= 0 ? 'text-emerald-700' : 'text-slate-900'}
          />
        </div>
        <div>
          <MetricRow label="Última atualização" value={formatDateTime(position.lastSyncedAt)} />
          <MetricRow label="Contratado por" value={position.contractedBy || '--'} />
          <MetricRow label="Protocolo" value={protocol} />
        </div>
      </div>
    </Card>
  );
};

const PasswordModal = ({
  product,
  amount,
  password,
  error,
  loading,
  onClose,
  onPasswordChange,
  onConfirm,
}) => {
  if (!product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={loading ? undefined : onClose} />
      <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl shadow-slate-900/20">
        <div className="mb-5">
          <p className="text-sm font-semibold text-violet-700 mb-2">Confirmação de segurança</p>
          <h2 className="text-xl font-bold text-slate-900">Confirmar aplicação</h2>
          <p className="text-sm text-slate-500 mt-1">
            Digite a senha da conta para aplicar {formatCurrency(Number(amount || 0))} em {product.name}.
          </p>
        </div>

        <form onSubmit={onConfirm} className="space-y-4">
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">Senha da conta</span>
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-lg font-bold tracking-normal text-slate-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
              placeholder="Digite sua senha"
              disabled={loading}
            />
          </label>

          {error && (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              disabled={loading}
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              fullWidth
              loading={loading}
              disabled={loading}
            >
              Confirmar aplicação
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

const InvestmentsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [accountData, setAccountData] = useState(null);
  const [products, setProducts] = useState([]);
  const [positions, setPositions] = useState([]);
  const [amounts, setAmounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [subscribingCode, setSubscribingCode] = useState('');
  const [syncingId, setSyncingId] = useState('');
  const [pendingProduct, setPendingProduct] = useState(null);
  const [investmentPassword, setInvestmentPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [validatingPassword, setValidatingPassword] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [authLoading, user, navigate]);

  const resolveAccount = useCallback(async () => {
    const storedAccountId = user?.accountId || localStorage.getItem('accountId');
    const cpf = user?.cpf || localStorage.getItem('cpf');

    if (storedAccountId) {
      return {
        id: Number(storedAccountId),
        cpf,
        nome: user?.nome || localStorage.getItem('nome') || 'Cliente DogBank',
      };
    }

    if (!cpf) {
      throw new Error('Conta não encontrada para carregar investimentos.');
    }

    const account = await accountService.getAccountInfo(cpf);
    return {
      ...account,
      id: account.id || account.accountId,
      cpf,
      nome: user?.nome || account.userName || localStorage.getItem('nome') || 'Cliente DogBank',
    };
  }, [user]);

  const loadInvestments = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const account = await resolveAccount();
      const [fetchedProducts, fetchedPositions] = await Promise.all([
        investmentService.getProducts(),
        investmentService.getPositions(account.id),
      ]);

      if (!Array.isArray(fetchedProducts) || !Array.isArray(fetchedPositions)) {
        throw new Error('Backend de investimentos ainda não está disponível no ambiente selecionado.');
      }

      const nextAmounts = {};
      fetchedProducts.forEach((product) => {
        nextAmounts[product.code] = amounts[product.code] || defaultAmountFor(product.code);
      });

      setAccountData(account);
      setProducts(fetchedProducts);
      setPositions(fetchedPositions);
      setAmounts(nextAmounts);

      datadogRum.addAction('dogbank.web.investments.loaded', {
        account_id: account.id,
        product_count: fetchedProducts.length,
        position_count: fetchedPositions.length,
        technical_divergence_count: fetchedPositions.filter((position) => position.status !== 'SYNCED').length,
      });
    } catch (err) {
      console.error('Erro ao carregar investimentos:', err);
      setError(err.response?.data?.message || err.message || 'Não foi possível carregar investimentos.');
      datadogRum.addError(err, { flow: 'web_investments_load' });
    } finally {
      setLoading(false);
    }
  }, [amounts, resolveAccount]);

  useEffect(() => {
    if (user || localStorage.getItem('cpf')) {
      loadInvestments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const summary = useMemo(() => {
    const appliedTotal = positions.reduce((total, position) => total + numeric(position.principalAmount), 0);
    const currentTotal = positions.reduce((total, position) => total + numeric(position.currentValue), 0);
    const yieldTotal = currentTotal - appliedTotal;

    return { appliedTotal, currentTotal, yieldTotal };
  }, [positions]);

  const handleAmountChange = (productCode, value) => {
    setAmounts((current) => ({ ...current, [productCode]: value }));
  };

  const closePasswordModal = () => {
    if (validatingPassword || subscribingCode) return;
    setPendingProduct(null);
    setInvestmentPassword('');
    setPasswordError('');
  };

  const requestSubscription = (product) => {
    setError('');
    setNotice('');
    setPasswordError('');
    setInvestmentPassword('');
    setPendingProduct(product);
  };

  const upsertPosition = (updatedPosition) => {
    setPositions((current) => {
      const exists = current.some((position) => position.positionId === updatedPosition.positionId);
      if (!exists) return [updatedPosition, ...current];
      return current.map((position) => (
        position.positionId === updatedPosition.positionId ? updatedPosition : position
      ));
    });
  };

  const executeSubscription = async (product) => {
    const amount = Number(amounts[product.code] || defaultAmountFor(product.code));
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Informe um valor de aporte válido.');
      return;
    }

    try {
      setError('');
      setNotice('');
      setSubscribingCode(product.code);
      datadogRum.addAction('dogbank.web.investments.subscription.started', {
        account_id: accountData?.id,
        product_code: product.code,
        amount,
      });

      const position = await investmentService.subscribe({
        accountId: accountData.id,
        cpf: accountData.cpf || user?.cpf || localStorage.getItem('cpf'),
        userName: user?.nome || accountData.nome || accountData.userName || 'Cliente DogBank',
        productCode: product.code,
        amount,
        requestedBy: 'frontend-react',
      });

      upsertPosition(position);
      setNotice('Aplicação contratada com sucesso.');
      setPendingProduct(null);
      setInvestmentPassword('');
      setPasswordError('');

      datadogRum.addAction('dogbank.web.investments.subscription.completed', {
        account_id: accountData.id,
        product_code: product.code,
        position_id: position.positionId,
        backend_status: position.status,
        amount,
      });
    } catch (err) {
      console.error('Erro ao contratar investimento:', err);
      setError(err.response?.data?.message || err.message || 'Não foi possível contratar o investimento.');
      datadogRum.addError(err, {
        flow: 'web_investment_subscription',
        product_code: product.code,
        amount,
      });
    } finally {
      setSubscribingCode('');
    }
  };

  const handlePasswordConfirm = async (event) => {
    event.preventDefault();

    if (!pendingProduct) return;

    const cpf = accountData?.cpf || user?.cpf || localStorage.getItem('cpf');
    if (!cpf) {
      setPasswordError('Não foi possível identificar a sessão da conta.');
      return;
    }

    if (!investmentPassword.trim()) {
      setPasswordError('Digite a senha da conta.');
      return;
    }

    try {
      setValidatingPassword(true);
      setPasswordError('');

      datadogRum.addAction('dogbank.web.investments.password_validation.started', {
        account_id: accountData?.id,
        product_code: pendingProduct.code,
      });

      const result = await authService.validatePassword(cpf, investmentPassword);
      if (!result?.valid) {
        setPasswordError(result?.message || 'Senha incorreta.');
        datadogRum.addAction('dogbank.web.investments.password_validation.failed', {
          account_id: accountData?.id,
          product_code: pendingProduct.code,
        });
        return;
      }

      datadogRum.addAction('dogbank.web.investments.password_validation.completed', {
        account_id: accountData?.id,
        product_code: pendingProduct.code,
      });

      await executeSubscription(pendingProduct);
    } catch (err) {
      console.error('Erro ao validar senha do investimento:', err);
      setPasswordError(err.response?.data?.message || 'Não foi possível validar a senha agora.');
      datadogRum.addError(err, {
        flow: 'web_investment_password_validation',
        product_code: pendingProduct.code,
      });
    } finally {
      setValidatingPassword(false);
    }
  };

  const handleSync = async (position) => {
    try {
      setError('');
      setNotice('');
      setSyncingId(position.positionId);
      datadogRum.addAction('dogbank.web.investments.refresh.started', {
        account_id: accountData?.id,
        position_id: position.positionId,
        product_code: position.productCode,
      });

      const updated = await investmentService.syncPosition(position.positionId);
      upsertPosition(updated);
      setNotice('Valor da aplicação atualizado.');

      datadogRum.addAction('dogbank.web.investments.refresh.completed', {
        position_id: updated.positionId,
        product_code: updated.productCode,
        backend_status: updated.status,
      });
    } catch (err) {
      console.error('Erro ao atualizar investimento:', err);
      setError('Estamos atualizando essa aplicação. Tente novamente em instantes.');
      datadogRum.addError(err, {
        flow: 'web_investment_refresh',
        position_id: position.positionId,
        product_code: position.productCode,
      });
    } finally {
      setSyncingId('');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-200 rounded-full animate-spin border-t-purple-600 mx-auto mb-6" />
          <p className="text-slate-600 font-medium">Carregando investimentos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Investimentos</h1>
          <p className="text-sm text-slate-500">
            Acompanhe seus aportes em CDI 100% e Bitcoin.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<RefreshCw className="w-4 h-4" />}
          onClick={loadInvestments}
        >
          Atualizar
        </Button>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}
      {notice && <Alert type="success" message={notice} onClose={() => setNotice('')} />}

      <section className="rounded-3xl bg-slate-900 text-white p-6 md:p-8 shadow-lg shadow-slate-900/10 overflow-hidden relative">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <p className="text-sm font-semibold text-white/70 mb-2">Patrimônio em investimentos</p>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-normal">
              {formatCurrency(summary.currentTotal)}
            </h2>
            <p className="text-sm text-white/70 mt-3">
              {positions.length} {positionLabel(positions.length)} na conta {accountData?.id || '--'}.
            </p>
          </div>
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center">
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={Landmark}
          label="Total aplicado"
          value={formatCurrency(summary.appliedTotal)}
          helper="Soma dos aportes"
          tone="blue"
        />
        <StatCard
          icon={Wallet}
          label="Saldo atual"
          value={formatCurrency(summary.currentTotal)}
          helper="Valor contabilizado na carteira"
          tone="purple"
        />
        <StatCard
          icon={Clock3}
          label="Rendimento"
          value={formatCurrency(summary.yieldTotal)}
          helper="Variação acumulada"
          tone={summary.yieldTotal >= 0 ? 'green' : 'blue'}
        />
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Produtos disponíveis</h2>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {products.map((product) => (
            <ProductCard
              key={product.code}
              product={product}
              amount={amounts[product.code] || defaultAmountFor(product.code)}
              disabled={subscribingCode === product.code}
              onAmountChange={handleAmountChange}
              onSubscribe={requestSubscription}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Minha carteira</h2>
          <span className="text-xs font-semibold text-slate-500 bg-white px-3 py-1.5 rounded-full border border-slate-200">
            {positions.length} {positionLabel(positions.length)}
          </span>
        </div>

        {positions.length === 0 ? (
          <Card className="text-center" bodyClassName="py-12">
            <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-700 flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 mb-1">Nenhum investimento encontrado</h3>
            <p className="text-sm text-slate-500">A carteira aparecerá aqui após uma aplicação.</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {positions.map((position) => (
              <PositionCard
                key={position.positionId}
                position={position}
                syncing={syncingId === position.positionId}
                onSync={handleSync}
              />
            ))}
          </div>
        )}
      </section>

      <PasswordModal
        product={pendingProduct}
        amount={pendingProduct ? amounts[pendingProduct.code] || defaultAmountFor(pendingProduct.code) : 0}
        password={investmentPassword}
        error={passwordError}
        loading={validatingPassword || Boolean(subscribingCode)}
        onClose={closePasswordModal}
        onPasswordChange={setInvestmentPassword}
        onConfirm={handlePasswordConfirm}
      />
    </div>
  );
};

export default InvestmentsPage;
