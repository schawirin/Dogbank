import { accountApi } from './api';

/**
 * Serviço para comunicação com o account-module do backend
 */
const accountService = {
  /**
   * Obtém as informações da conta do usuário pelo CPF
   * @param {string} cpf - CPF do usuário
   * @returns {Promise} - Promessa com os dados da conta
   */
  getAccountInfo: async (cpf) => {
    try {
      console.log(`🔍 Buscando informações da conta para CPF: ${cpf}`);
      
      const response = await accountApi.get(`/user/${cpf}`); // ✅ CORRIGIDO: era '/api/accounts/user/', agora é só '/user/'
      console.log('✅ Resposta de dados da conta:', response.data);
      
      // Normalizar a resposta da API para garantir consistência
      const accountData = {
        ...response.data,
        saldo: response.data.balance,  // Adicionar campo "saldo" com valor de "balance"
        numero_conta: response.data.accountNumber  // Normalizar outros campos se necessário
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
          cpf: cpf,
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
      
      const response = await accountApi.get(`/${accountId}/balance`); // ✅ CORRIGIDO: era '/api/accounts/${accountId}/balance', agora é só '/${accountId}/balance'
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
      
      const response = await accountApi.get(`/${accountId}/history`); // ✅ CORRIGIDO: era '/api/accounts/${accountId}/history', agora é só '/${accountId}/history'
      console.log('✅ Resposta de histórico:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao buscar histórico da conta:', error);
      
      // Para desenvolvimento - simulação de dados
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Usando histórico simulado');
        // Mock de dados para teste local
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