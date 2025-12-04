import React, { useState, useEffect } from 'react';
import {
  getMetrics,
  getLogs,
  getDashboard,
  getSLOs,
  checkDatadogHealth,
} from '../../services/datadogService';
import './DatadogMetrics.css';

/**
 * Componente para exibir métricas do Datadog de forma segura
 * 
 * As requisições são feitas através do backend proxy que mantém
 * a API key segura. O frontend nunca acessa a API key diretamente.
 */
export const DatadogMetrics = () => {
  const [metrics, setMetrics] = useState(null);
  const [logs, setLogs] = useState(null);
  const [slos, setSlos] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Verificar saúde do Datadog na montagem
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const healthData = await checkDatadogHealth();
        setHealth(healthData);
      } catch (err) {
        console.error('Erro ao verificar saúde:', err);
      }
    };

    checkHealth();
  }, []);

  // Buscar métricas
  const handleFetchMetrics = async () => {
    setLoading(true);
    setError(null);

    try {
      const now = Math.floor(Date.now() / 1000);
      const oneHourAgo = now - 3600;

      // Buscar métrica de CPU
      const data = await getMetrics('avg:system.cpu{*}', oneHourAgo, now);
      setMetrics(data);
    } catch (err) {
      setError(`Erro ao buscar métricas: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Buscar logs
  const handleFetchLogs = async () => {
    setLoading(true);
    setError(null);

    try {
      const now = Date.now();
      const oneHourAgo = now - 3600000;

      // Buscar logs de erros
      const data = await getLogs('status:error', oneHourAgo, now);
      setLogs(data);
    } catch (err) {
      setError(`Erro ao buscar logs: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Buscar SLOs
  const handleFetchSLOs = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getSLOs();
      setSlos(data);
    } catch (err) {
      setError(`Erro ao buscar SLOs: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="datadog-metrics-container">
      <div className="header">
        <h1>📊 Métricas do Datadog</h1>
        <p className="subtitle">
          Dados seguros obtidos através de proxy no backend
        </p>
      </div>

      {/* Status do Datadog */}
      <div className={`health-status ${health?.status.toLowerCase()}`}>
        <span className="status-indicator"></span>
        <span>
          Datadog: {health?.status === 'UP' ? '✅ Conectado' : '❌ Desconectado'}
        </span>
      </div>

      {/* Mensagens de erro */}
      {error && <div className="error-message">{error}</div>}

      {/* Botões de ação */}
      <div className="action-buttons">
        <button
          onClick={handleFetchMetrics}
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? 'Carregando...' : '📈 Carregar Métricas'}
        </button>

        <button
          onClick={handleFetchLogs}
          disabled={loading}
          className="btn btn-secondary"
        >
          {loading ? 'Carregando...' : '📝 Carregar Logs'}
        </button>

        <button
          onClick={handleFetchSLOs}
          disabled={loading}
          className="btn btn-success"
        >
          {loading ? 'Carregando...' : '🎯 Carregar SLOs'}
        </button>
      </div>

      {/* Exibição de dados */}
      <div className="data-sections">
        {metrics && (
          <section className="data-section">
            <h2>Métricas</h2>
            <pre>{JSON.stringify(metrics, null, 2)}</pre>
          </section>
        )}

        {logs && (
          <section className="data-section">
            <h2>Logs</h2>
            <pre>{JSON.stringify(logs, null, 2)}</pre>
          </section>
        )}

        {slos && (
          <section className="data-section">
            <h2>SLOs</h2>
            <pre>{JSON.stringify(slos, null, 2)}</pre>
          </section>
        )}
      </div>
    </div>
  );
};

export default DatadogMetrics;
