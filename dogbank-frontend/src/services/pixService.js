import { transactionApi, bancoCentralApi, authApi } from './api';
import authService from './authService';

const pixService = {
  async validatePixKey(pixKey, amount) {
    try {
      const { data } = await bancoCentralApi.post('/pix/validate', { pixKey, amount });
      return data;
    } catch (error) {
      console.error('Erro ao validar chave PIX:', error);
      throw error;
    }
  },

  async executePix({ pixKey, amount, description = '', password, sourceAccountId }) {
    if (!pixKey) {
      throw new Error('Chave PIX não informada');
    }
    if (!password) {
      throw new Error('Senha bancária não informada');
    }

    const cpf = authService.getCpf();
    if (!cpf) {
      throw new Error('CPF não encontrado na sessão');
    }
    
    // 1) Validar senha no auth-module
    const validateResponse = await authApi.post('/validate-password', {
      cpf: cpf,
      password: password
    });
    
    if (!validateResponse.data.valid) {
      throw new Error(validateResponse.data.message || 'Senha incorreta');
    }

    // 2) Validação da chave junto ao Banco Central
    const validation = await this.validatePixKey(pixKey, amount);
    if (validation.status !== 'APPROVED') {
      throw new Error(validation.error || 'Chave PIX não aprovada pelo Banco Central');
    }

    // 3) Envio para o serviço de transações (SEM senha)
    const payload = {
      accountOriginId: sourceAccountId,
      pixKeyDestination: pixKey,
      amount,
      description
    };

    try {
      const { data } = await transactionApi.post('/pix', payload);
      return data;
    } catch (error) {
      console.error('Erro ao executar PIX:', error);
      throw error;
    }
  },

  async getTransactionHistory(accountId) {
    try {
      // URL correta: /api/transactions/account/{accountId}
      const { data } = await transactionApi.get(`/account/${accountId}`);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      return []; // Retornar array vazio em vez de throw
    }
  }
};

export default pixService;