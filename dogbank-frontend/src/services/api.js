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
    
    console.log('🚀 Fazendo requisição:', {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      fullURL: `${config.baseURL || ''}${config.url || ''}`
    });
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor de response (compartilhado)
api.interceptors.response.use(
  (response) => {
    console.log('✅ Resposta recebida:', {
      status: response.status,
      url: response.config.url
    });
    return response;
  },
  (error) => {
    console.error('❌ Erro na requisição:', {
      message: error.message,
      url: error.config?.url,
      status: error.response?.status,
      responseData: error.response?.data
    });
    
    if (error.response?.status === 401) {
      localStorage.clear();
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Instâncias específicas para cada módulo
// WORKAROUND: Traefik está removendo o prefixo /api/auth, então duplicamos
export const authApi = axios.create({
  baseURL: '/api/auth/api/auth',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// WORKAROUND: Traefik está removendo os prefixos, então duplicamos
export const accountApi = axios.create({
  baseURL: '/api/accounts/api/accounts',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

export const transactionApi = axios.create({
  baseURL: '/api/transactions/api/transactions',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

export const integrationApi = axios.create({
  baseURL: '/api/integration/api/integration',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

export const notificationApi = axios.create({
  baseURL: '/api/notifications/api/notifications',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

export const bancoCentralApi = axios.create({
  baseURL: '/api/bancocentral/api/bancocentral',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Aplicar interceptors em todas as instâncias
[authApi, accountApi, transactionApi, integrationApi, notificationApi, bancoCentralApi].forEach(instance => {
  instance.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );
  
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        localStorage.clear();
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    }
  );
});

export default api;