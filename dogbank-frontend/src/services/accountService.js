import { accountApi } from './api';

/**
 * Serviço para comunicação com o account-module do backend
 */
const accountService = {
  /**
   * Obtém as informações da conta do usuário pelo userId
   * @param {string|number} userId - ID do usuário
   * @returns {Promise} - Promessa com os dados da conta
   */
  getAccountInfo: async (userId) => {
    try {
      console.log(`🔍 Buscando informações da conta para userId: ${userId}`);
      
      const response = await accountApi.get(`/user/${userId}`);
      console.log('✅ Resposta de dados da conta:', response.data);
      
      // Normalizar a resposta da API para garantir consistência
      const accountData = {
        ...response.data,
        saldo: response.data.balance,
        numero_conta: response.data.accountNumber
      };
      
      return accountData;
    } catch (error) {
      console.error('❌ Erro ao buscar informações da conta:', error);
      
      // Para desenvolvimento - simulação de dados
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Usando dados simulados da conta');
        return {
          id: 1,
          accountNumber: '12345-6',
          saldo: 10000.00,
          balance: 10000.00,
          userId: userId,
          nome: 'Usuário Teste'
        };
      }
      
      throw error;
    }
  },
  
  /**
   * Obtém o saldo atual da conta
   * @param {number} accountId - ID da conta
   * @returns {Promise} - Promessa com o saldo da conta
   */
  getBalance: async (accountId) => {
    try {
      console.log(`💰 Buscando saldo para a conta ID: ${accountId}`);
      
      const response = await accountApi.get(`/${accountId}/balance`);
      console.log('✅ Resposta de saldo:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao buscar saldo:', error);
      
      // Para desenvolvimento - simulação de dados
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Usando saldo simulado');
        return { saldo: 10000.00 };
      }
      
      throw error;
    }
  },
  
  /**
   * Busca histórico de conta
   * @param {number} accountId - ID da conta
   * @returns {Promise} - Promessa com o histórico de transações da conta
   */
  getAccountHistory: async (accountId) => {
    try {
      console.log(`📋 Buscando histórico para a conta ID: ${accountId}`);
      
      const response = await accountApi.get(`/${accountId}/history`);
      console.log('✅ Resposta de histórico:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao buscar histórico da conta:', error);
      
      // Para desenvolvimento - simulação de dados
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Usando histórico simulado');
        return [
          {
            id: 1,
            tipo: 'enviado',
            valor: 100.00,
            data: '2023-05-10T14:30:00',
            destinatario: 'João Silva',
            origem: '',
            descricao: 'Pagamento'
          },
          {
            id: 2,
            tipo: 'recebido',
            valor: 250.00,
            data: '2023-05-08T10:15:00',
            destinatario: '',
            origem: 'Maria Oliveira',
            descricao: 'Transferência'
          },
          {
            id: 3,
            tipo: 'enviado',
            valor: 50.00,
            data: '2023-05-05T16:45:00',
            destinatario: 'Carlos Souza',
            origem: '',
            descricao: 'Reembolso'
          }
        ];
      }
      
      throw error;
    }
  }
};

export default accountService;