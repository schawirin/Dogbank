import axios from 'axios';

// Instância base do Axios
const api = axios.create({
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Interceptor de request (compartilhado)
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // DEBUG: Log de todas as requisições
    console.log('🚀 Fazendo requisição:', {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      fullURL: `${config.baseURL || ''}${config.url || ''}`,
      headers: config.headers
    });
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor de response (compartilhado)
api.interceptors.response.use(
  (response) => {
    // DEBUG: Log de respostas bem-sucedidas
    console.log('✅ Resposta recebida:', {
      status: response.status,
      url: response.config.url,
      data: response.data
    });
    return response;
  },
  (error) => {
    // DEBUG: Log detalhado de erros
    console.error('❌ Erro na requisição:', {
      message: error.message,
      url: error.config?.url,
      baseURL: error.config?.baseURL,
      fullURL: `${error.config?.baseURL || ''}${error.config?.url || ''}`,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data
    });
    
    if (error.response) {
      console.error('Erro da API:', error.response.data);
      if (error.response.status === 401) {
        localStorage.clear();
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    } else if (error.request) {
      console.error('Não foi possível conectar ao servidor:', error.request);
    } else {
      console.error('Erro ao configurar requisição:', error.message);
    }
    return Promise.reject(error);
  }
);

// Instâncias específicas para cada módulo
export const authApi = axios.create({
  baseURL: '/api/auth',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

export const accountApi = axios.create({
  baseURL: '/api/accounts',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// CORREÇÃO CRÍTICA: baseURL deve ser '/api/transactions'
export const transactionApi = axios.create({
  baseURL: '/api/transactions',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

export const integrationApi = axios.create({
  baseURL: '/api/integration',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

export const notificationApi = axios.create({
  baseURL: '/api/notifications',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

export const bancoCentralApi = axios.create({
  baseURL: '/api/bancocentral',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// DEBUG: Verificar configurações das instâncias
console.log('🔧 Configurações das APIs:', {
  authApi: authApi.defaults.baseURL,
  accountApi: accountApi.defaults.baseURL,
  transactionApi: transactionApi.defaults.baseURL,
  integrationApi: integrationApi.defaults.baseURL,
  notificationApi: notificationApi.defaults.baseURL,
  bancoCentralApi: bancoCentralApi.defaults.baseURL
});

// Reaplica os mesmos interceptadores às instâncias específicas
const sharedRequestInterceptor = api.interceptors.request.handlers[0];
const sharedResponseInterceptor = api.interceptors.response.handlers[0];

[authApi, accountApi, transactionApi, integrationApi, notificationApi, bancoCentralApi].forEach(instance => {
  instance.interceptors.request.use(
    sharedRequestInterceptor.fulfilled,
    sharedRequestInterceptor.rejected
  );
  instance.interceptors.response.use(
    sharedResponseInterceptor.fulfilled,
    sharedResponseInterceptor.rejected
  );
});

export default api;