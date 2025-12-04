import React, { useState, useEffect } from 'react';
import {
  getMetrics,
  getLogs,
  checkDatadogHealth,
} from '../../services/datadogService';

/**
 * Exemplo de componente que usa as métricas do Datadog
 * de forma segura através do backend proxy
 */
export const DatadogDashboardExample = () => {
  const [transactionMetrics, setTransactionMetrics] = useState(null);
  const [errorLogs, setErrorLogs] = useState(null);
  const [loading, setLoading] = useState(false);

  // Buscar métricas na montagem
  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);

    try {
      // Obter timestamps
      const now = Math.floor(Date.now() / 1000);
      const oneHourAgo = now - 3600;
      const oneHourAgoMs = Date.now() - 3600000;

      // Buscar métricas de transações PIX
      const metrics = await getMetrics(
        'avg:custom.pix.transaction_time{service:transactions}',
        oneHourAgo,
        now
      );
      setTransactionMetrics(metrics);

      // Buscar logs de erro
      const logs = await getLogs(
        'service:transactions status:error',
        oneHourAgoMs,
        Date.now()
      );
      setErrorLogs(logs);

    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="datadog-dashboard">
      <h1>📊 Dashboard de Transações PIX</h1>
      
      <button 
        onClick={fetchDashboardData}
        disabled={loading}
      >
        {loading ? 'Carregando...' : 'Atualizar Métricas'}
      </button>

      {transactionMetrics && (
        <section className="metrics-section">
          <h2>Tempo Médio de Transação</h2>
          <p>{JSON.stringify(transactionMetrics)}</p>
        </section>
      )}

      {errorLogs && (
        <section className="logs-section">
          <h2>Logs de Erro</h2>
          <pre>{JSON.stringify(errorLogs, null, 2)}</pre>
        </section>
      )}
    </div>
  );
};

export default DatadogDashboardExample;
