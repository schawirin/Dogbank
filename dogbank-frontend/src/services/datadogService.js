import axios from 'axios';

/**
 * Cliente para comunicação com Datadog via backend proxy
 * 
 * IMPORTANTE: A API key é mantida no backend e não é exposta no frontend
 * O frontend faz requisições para os endpoints REST do backend
 */

const DATADOG_API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

const datadogApi = axios.create({
  baseURL: `${DATADOG_API_BASE_URL}/api/observability/datadog`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

/**
 * Busca métricas do Datadog
 * @param {string} query - Query da métrica (ex: "avg:system.cpu{*}")
 * @param {number} from - Timestamp inicial (em segundos)
 * @param {number} to - Timestamp final (em segundos)
 * @returns {Promise<Object>} Dados da métrica
 */
export const getMetrics = async (query, from, to) => {
  try {
    const response = await datadogApi.get('/metrics', {
      params: { query, from, to },
    });
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar métricas:', error);
    throw error;
  }
};

/**
 * Busca logs do Datadog
 * @param {string} query - Query dos logs
 * @param {number} from - Timestamp inicial (em milissegundos)
 * @param {number} to - Timestamp final (em milissegundos)
 * @returns {Promise<Object>} Dados dos logs
 */
export const getLogs = async (query, from, to) => {
  try {
    const response = await datadogApi.get('/logs', {
      params: { query, from, to },
    });
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar logs:', error);
    throw error;
  }
};

/**
 * Busca dados de um dashboard específico
 * @param {string} dashboardId - ID do dashboard no Datadog
 * @returns {Promise<Object>} Dados do dashboard
 */
export const getDashboard = async (dashboardId) => {
  try {
    const response = await datadogApi.get(`/dashboard/${dashboardId}`);
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar dashboard:', error);
    throw error;
  }
};

/**
 * Busca SLOs (Service Level Objectives)
 * @returns {Promise<Object>} Dados dos SLOs
 */
export const getSLOs = async () => {
  try {
    const response = await datadogApi.get('/slos');
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar SLOs:', error);
    throw error;
  }
};

/**
 * Verifica se Datadog está configurado e disponível
 * @returns {Promise<Object>} Status da configuração
 */
export const checkDatadogHealth = async () => {
  try {
    const response = await datadogApi.get('/health');
    return response.data;
  } catch (error) {
    console.error('Erro ao verificar saúde do Datadog:', error);
    return { status: 'DOWN', datadog_configured: false };
  }
};

export default datadogApi;
