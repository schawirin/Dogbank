// src/services/pixService.js
import { transactionApi, bancoCentralApi } from './api';
import authService from './authService';

/**
 * Serviço central com todas as operações relacionadas a PIX
 */
const pixService = {
  /**
   * Valida chave PIX junto ao Banco Central
   * @param {string} pixKey
   * @param {number} amount
   * @returns {Promise<{status: string, error?: string}>}
   */
  async validatePixKey(pixKey, amount) {
    try {
      console.log('🔍 Validando chave PIX:', { pixKey, amount });
      console.log('🔍 bancoCentralApi baseURL:', bancoCentralApi.defaults.baseURL);
      
      const { data } = await bancoCentralApi.post(
        '/pix/validate',
        { pixKey, amount }
      );
      
      console.log('✅ Chave PIX validada:', data);
      return data;
    } catch (error) {
      console.error('❌ Erro ao validar chave PIX:', error.response?.data || error.message || error);
      throw error;
    }
  },

  /**
   * Executa a transferência PIX: autentica senha, valida chave e dispara a transação
   * @param {{ pixKey: string, amount: number, description?: string, password: string, sourceAccountId: number }}
   * @returns {Promise<Object>} recibo completo
   */
  async executePix({ pixKey, amount, description = '', password, sourceAccountId }) {
    console.log('🔄 Iniciando execução PIX:', { pixKey, amount, description, sourceAccountId });
    
    if (!pixKey) {
      throw new Error('Chave PIX não informada');
    }
    if (!password) {
      throw new Error('Senha bancária não informada');
    }

    // 1) Autentica usuário com senha
    const cpf = authService.getCpf();
    if (!cpf) {
      throw new Error('CPF não encontrado na sessão');
    }
    
    console.log('🔐 Autenticando usuário:', cpf);
    await authService.login(cpf, password);

    // 2) Validação da chave junto ao Banco Central
    console.log('🔍 Validando chave PIX no Banco Central...');
    const validation = await this.validatePixKey(pixKey, amount);
    if (validation.status !== 'APPROVED') {
      throw new Error(validation.error || 'Chave PIX não aprovada pelo Banco Central');
    }

    // 3) Envio para o serviço de transações
    const payload = {
      accountOriginId: sourceAccountId,
      pixKeyDestination: pixKey,
      amount,
      description
    };

    try {
      // DEBUG: Verificar URL completa
      const fullUrl = transactionApi.defaults.baseURL + '/pix';
      console.log('🔍 URL completa do PIX:', fullUrl);
      console.log('🔍 BaseURL do transactionApi:', transactionApi.defaults.baseURL);
      console.log('🔍 Payload do PIX:', payload);
      
      const { data } = await transactionApi.post('/pix', payload);
      
      console.log('✅ PIX executado com sucesso:', data);
      return data;
    } catch (error) {
      console.error('❌ Erro detalhado PIX:', {
        message: error.message,
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        fullURL: `${error.config?.baseURL || ''}${error.config?.url || ''}`,
        status: error.response?.status,
        responseData: error.response?.data
      });
      throw error;
    }
  },

  /**
   * Retorna histórico de transações de uma conta
   * @param {number} accountId
   * @returns {Promise<Array>} lista de transações
   */
  async getTransactionHistory(accountId) {
    try {
      // DEBUG: Verificar URL completa
      const fullUrl = transactionApi.defaults.baseURL + `/account/${accountId}`;
      console.log('🔍 URL completa da requisição de histórico:', fullUrl);
      console.log('🔍 BaseURL do transactionApi:', transactionApi.defaults.baseURL);
      console.log('🔍 URL atual da página:', window.location.href);
      console.log('🔍 AccountId:', accountId);
      
      const { data } = await transactionApi.get(`/account/${accountId}`);
      
      console.log('✅ Histórico de transações obtido:', data);
      return data;
    } catch (error) {
      console.error('❌ Erro detalhado ao buscar histórico:', {
        message: error.message,
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        fullURL: `${error.config?.baseURL || ''}${error.config?.url || ''}`,
        status: error.response?.status,
        responseData: error.response?.data
      });
      throw error;
    }
  }
};

export default pixService;