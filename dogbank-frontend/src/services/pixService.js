// src/services/pixService.js
import { transactionApi, bancoCentralApi, authApi } from './api';
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
      
      // 1) Primeiro verifica se a chave existe no auth-service (banco de dados local)
      console.log('🔍 Verificando se chave PIX existe no sistema...');
      try {
        const authResponse = await authApi.get(`/validate-pix?chavePix=${encodeURIComponent(pixKey)}`);
        console.log('🔍 Resposta do auth-service:', authResponse.data);
        
        if (!authResponse.data.valid) {
          console.warn('⚠️ Chave PIX não encontrada no sistema');
          return {
            status: 'REJECTED',
            error: 'Chave PIX não encontrada no sistema. Verifique se a chave está correta.',
            valid: false
          };
        }
        
        // Guarda os dados do usuário para retornar depois
        const userData = authResponse.data.user;
        console.log('✅ Usuário encontrado:', userData);
        
        // 2) Depois valida no Banco Central
        const { data } = await bancoCentralApi.post(
          '/pix/validate',
          { pixKey, amount }
        );
        
        console.log('✅ Chave PIX validada no Banco Central:', data);
        
        // Retorna com os dados do usuário
        return {
          ...data,
          valid: data.status === 'APPROVED',
          user: userData
        };
      } catch (authError) {
        // Se o auth-service retornar 404, a chave não existe
        if (authError.response?.status === 404) {
          return {
            status: 'REJECTED',
            error: 'Chave PIX não encontrada. Verifique se a chave está correta.',
            valid: false
          };
        }
        throw authError;
      }
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
      
      // Transforma os dados para o formato esperado pelo frontend
      const transformedData = data.map(tx => {
        // Determina se é enviado ou recebido baseado no accountOriginId
        const isEnviado = tx.accountOriginId === accountId;
        
        return {
          id: tx.id,
          tipo: isEnviado ? 'enviado' : 'recebido',
          valor: tx.amount,
          amount: tx.amount,
          data: tx.completedAt || tx.startedAt || tx.date,
          createdAt: tx.startedAt,
          completedAt: tx.completedAt,
          destinatario: tx.receiverName,
          receiverName: tx.receiverName,
          origem: tx.senderName,
          senderName: tx.senderName,
          descricao: tx.description,
          description: tx.description,
          pixKey: tx.pixKeyDestination,
          receiverBank: tx.receiverBank,
          senderBank: tx.senderBankCode
        };
      });
      
      console.log('✅ Transações transformadas:', transformedData);
      return transformedData;
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