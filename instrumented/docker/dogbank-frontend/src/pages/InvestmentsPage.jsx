import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Bitcoin,
  CheckCircle2,
  Clock3,
  Percent,
  PlusCircle,
  RefreshCw,
  Search,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { datadogRum } from '@datadog/browser-rum';
import { useAuth } from '../hooks/useAuth';
import accountService from '../services/accountService';
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

const statusTone = (position) => {
  if (position.status === 'SYNCED') {
    return {
      label: 'OK',
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-100',
      icon: CheckCircle2,
    };
  }

  const drift = Math.abs(numeric(position.driftAmount));
  if (drift > 10000) {
    return {
      label: 'DRIFT',
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-100',
      icon: AlertTriangle,
    };
  }

  return {
    label: 'DRIFT',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-100',
    icon: AlertTriangle,
  };
};

const StatCard = ({ icon: Icon, label, value, helper, tone = 'purple' }) => {
  const colors = {
    purple: 'bg-violet-50 text-violet-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
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
          <p className="text-xs text-slate-500 mb-1">{isBitcoin ? 'Cotação' : 'Taxa anual'}</p>
          <p className="text-sm font-bold text-slate-900">
            {isBitcoin ? formatCurrency(numeric(product.referencePrice)) : formatPercent(product.annualRate)}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-500 mb-1">Fonte</p>
          <p className="text-sm font-bold text-slate-900 truncate">{product.quoteSource || 'DogBank'}</p>
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
  const tone = statusTone(position);
  const StatusIcon = tone.icon;
  const isDrifted = position.status !== 'SYNCED';

  return (
    <Card className={`border ${tone.border}`} bodyClassName="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-lg font-bold text-slate-900">{position.productName}</h3>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${tone.bg} ${tone.text}`}>
              <StatusIcon className="w-3.5 h-3.5" />
              {tone.label}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-mono break-all">{position.positionId}</p>
        </div>
        {isDrifted && (
          <Button
            size="sm"
            variant="secondary"
            loading={syncing}
            disabled={syncing}
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={() => onSync(position)}
          >
            Sincronizar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
        <div>
          <MetricRow label="Aplicado" value={formatCurrency(numeric(position.principalAmount))} />
          <MetricRow label="Valor contabilizado" value={formatCurrency(numeric(position.currentValue))} />
          <MetricRow label="Valor esperado" value={formatCurrency(numeric(position.expectedValue))} valueClassName="text-emerald-700" />
        </div>
        <div>
          <MetricRow
            label="Drift"
            value={`${formatCurrency(Math.abs(numeric(position.driftAmount)))} | ${Math.abs(numeric(position.driftPercent)).toFixed(2)}%`}
            valueClassName={isDrifted ? tone.text : 'text-emerald-700'}
          />
          <MetricRow label="Último sync" value={formatDateTime(position.lastSyncedAt)} />
          <MetricRow label="Contratado por" value={position.contractedBy || '--'} />
        </div>
      </div>

      <div className="rounded-xl bg-slate-50 px-4 py-3">
        <div className="flex items-start gap-3">
          <Search className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500">Audit ID</p>
            <p className="text-xs font-mono text-slate-800 break-all">{position.auditCorrelationId || '--'}</p>
            {position.syncReason && (
              <p className="text-xs text-slate-500 mt-2">Motivo: {position.syncReason}</p>
            )}
          </div>
        </div>
      </div>

      {position.message && (
        <p className="text-sm text-slate-500">{position.message}</p>
      )}
    </Card>
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
  const [syncingAll, setSyncingAll] = useState(false);

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
        drifted_count: fetchedPositions.filter((position) => position.status !== 'SYNCED').length,
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
    const expectedTotal = positions.reduce((total, position) => total + numeric(position.expectedValue), 0);
    const bookedTotal = positions.reduce((total, position) => total + numeric(position.currentValue), 0);
    const driftTotal = positions.reduce((total, position) => total + numeric(position.driftAmount), 0);
    const driftedCount = positions.filter((position) => position.status !== 'SYNCED').length;

    return { expectedTotal, bookedTotal, driftTotal, driftedCount };
  }, [positions]);

  const handleAmountChange = (productCode, value) => {
    setAmounts((current) => ({ ...current, [productCode]: value }));
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

  const handleSubscribe = async (product) => {
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
      setNotice(position.status === 'SYNCED'
        ? 'Investimento contratado e sincronizado.'
        : 'Investimento contratado com drift para investigação.');

      datadogRum.addAction('dogbank.web.investments.subscription.completed', {
        account_id: accountData.id,
        product_code: product.code,
        position_id: position.positionId,
        status: position.status,
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

  const handleSync = async (position) => {
    try {
      setError('');
      setNotice('');
      setSyncingId(position.positionId);
      datadogRum.addAction('dogbank.web.investments.sync.started', {
        account_id: accountData?.id,
        position_id: position.positionId,
        product_code: position.productCode,
      });

      const updated = await investmentService.syncPosition(position.positionId);
      upsertPosition(updated);
      setNotice('Posição sincronizada com sucesso.');

      datadogRum.addAction('dogbank.web.investments.sync.completed', {
        position_id: updated.positionId,
        product_code: updated.productCode,
        status: updated.status,
        drift_amount: updated.driftAmount,
      });
    } catch (err) {
      console.error('Erro ao sincronizar investimento:', err);
      const message = err.response?.data?.message || err.message || 'Não foi possível sincronizar a posição.';
      setError(`${message} Tente novamente para simular a recuperação.`);
      datadogRum.addError(err, {
        flow: 'web_investment_sync',
        position_id: position.positionId,
        product_code: position.productCode,
      });
    } finally {
      setSyncingId('');
    }
  };

  const handleRunSync = async () => {
    try {
      setError('');
      setNotice('');
      setSyncingAll(true);
      datadogRum.addAction('dogbank.web.investments.sync_all.started', {
        account_id: accountData?.id,
        position_count: positions.length,
      });

      const updatedPositions = await investmentService.runSync();
      setPositions(updatedPositions);
      setNotice('Rotina de sync executada.');
      datadogRum.addAction('dogbank.web.investments.sync_all.completed', {
        account_id: accountData?.id,
        position_count: updatedPositions.length,
        drifted_count: updatedPositions.filter((position) => position.status !== 'SYNCED').length,
      });
    } catch (err) {
      console.error('Erro ao executar sync:', err);
      setError(err.response?.data?.message || err.message || 'Não foi possível executar a rotina de sync.');
      datadogRum.addError(err, { flow: 'web_investment_sync_all' });
    } finally {
      setSyncingAll(false);
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
            CDI 100%, Bitcoin, auditoria de contratação e sincronização de carteira.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={loadInvestments}
          >
            Atualizar
          </Button>
          <Button
            size="sm"
            loading={syncingAll}
            disabled={syncingAll || positions.length === 0}
            icon={<Activity className="w-4 h-4" />}
            onClick={handleRunSync}
          >
            Rodar sync
          </Button>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}
      {notice && <Alert type="success" message={notice} onClose={() => setNotice('')} />}

      <section className="rounded-3xl bg-slate-900 text-white p-6 md:p-8 shadow-lg shadow-slate-900/10 overflow-hidden relative">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <p className="text-sm font-semibold text-white/70 mb-2">Valor esperado da carteira</p>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              {formatCurrency(summary.expectedTotal)}
            </h2>
            <p className="text-sm text-white/70 mt-3">
              {summary.driftedCount === 0
                ? 'Todas as posições estão sincronizadas.'
                : `Drift de ${formatCurrency(Math.abs(summary.driftTotal))} em ${summary.driftedCount} ${positionLabel(summary.driftedCount)}.`}
            </p>
          </div>
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center">
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={Wallet}
          label="Valor contabilizado"
          value={formatCurrency(summary.bookedTotal)}
          helper={`Conta ${accountData?.id || '--'}`}
          tone="blue"
        />
        <StatCard
          icon={AlertTriangle}
          label="Posições com drift"
          value={summary.driftedCount}
          helper={summary.driftedCount > 0 ? 'Investigar em APM e logs' : 'Sem divergência ativa'}
          tone={summary.driftedCount > 0 ? 'amber' : 'green'}
        />
        <StatCard
          icon={Clock3}
          label="Última atualização"
          value={formatDateTime(new Date().toISOString())}
          helper="Dados do investment-service"
          tone="purple"
        />
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Produtos para demo</h2>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {products.map((product) => (
            <ProductCard
              key={product.code}
              product={product}
              amount={amounts[product.code] || defaultAmountFor(product.code)}
              disabled={subscribingCode === product.code}
              onAmountChange={handleAmountChange}
              onSubscribe={handleSubscribe}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Carteira e drift</h2>
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
            <p className="text-sm text-slate-500">A carteira aparecerá aqui após uma contratação.</p>
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
    </div>
  );
};

export default InvestmentsPage;
