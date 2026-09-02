// src/services/pixService.js
import { transactionApi, bancoCentralApi, authApi } from './api';
import authService from './authService';

/**
 * Serviço central com todas as operações relacionadas a PIX
 */
const pixService = {
  /**
   * Valida chave PIX - apenas verifica se existe no sistema (auth-service)
   * NÃO chama o Banco Central aqui - isso é feito na execução do PIX
   * @param {string} pixKey
   * @returns {Promise<{valid: boolean, user?: object, error?: string}>}
   */
  async validatePixKey(pixKey) {
    try {
      console.log('🔍 Validando chave PIX no sistema local:', pixKey);
      
      // Apenas verifica se a chave existe no auth-service (banco de dados local)
      const authResponse = await authApi.get(`/validate-pix?chavePix=${encodeURIComponent(pixKey)}`);
      console.log('🔍 Resposta do auth-service:', authResponse.data);
      
      if (!authResponse.data.valid) {
        console.warn('⚠️ Chave PIX não encontrada no sistema');
        return {
          valid: false,
          error: 'Chave PIX não encontrada no sistema. Verifique se a chave está correta.'
        };
      }
      
      // Retorna os dados do usuário
      const userData = authResponse.data.user;
      console.log('✅ Usuário encontrado:', userData);
      
      return {
        valid: true,
        user: userData,
        status: 'FOUND'
      };
    } catch (error) {
      // Se o auth-service retornar 404, a chave não existe
      if (error.response?.status === 404) {
        return {
          valid: false,
          error: 'Chave PIX não encontrada. Verifique se a chave está correta.'
        };
      }
      console.error('❌ Erro ao validar chave PIX:', error.response?.data || error.message || error);
      throw error;
    }
  },

  /**
   * Executa a transferência PIX: autentica senha, valida no Banco Central e dispara a transação
   * O timeout do Banco Central acontece AQUI, não na validação da chave
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

    // 2) Envia DIRETO para o transaction-service, que é o ORQUESTRADOR:
    //    ele chama o Banco Central → SPI internamente (o timeout acontece lá) e
    //    registra a falha (pix.transferencia.falha / PIX_ERRO). NÃO chamamos o
    //    bancocentral direto do frontend — isso criava um "ponto cego" no
    //    observability (o transaction-service nunca era notificado do timeout).
    const payload = {
      accountOriginId: sourceAccountId,
      pixKeyDestination: pixKey,
      amount,
      description,
      password,
    };

    // Chave de idempotência ÚNICA por tentativa (padrão real: o cliente gera a
    // chave por requisição). Assim dois PIX distintos entre as MESMAS contas não
    // colidem — o double-click é evitado pela UI (botão desabilitado no submit).
    // Sem isso, o backend cairia na chave grosseira auto-{origem}-{destino}, que
    // dedupe por 24h e bloqueava, por ex., repetir Emiliano→Pedro (timeout do BC).
    const idempotencyKey =
      (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID)
        ? window.crypto.randomUUID()
        : `pix-${sourceAccountId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    try {
      console.log('🏦 Enviando PIX ao transaction-service (orquestra BC → SPI)...', payload);
      const { data } = await transactionApi.post('/pix', payload, {
        headers: { 'X-Idempotency-Key': idempotencyKey },
      });
      console.log('✅ PIX executado com sucesso:', data);
      return data;
    } catch (error) {
      console.error('❌ Erro no PIX (transaction-service):', {
        status: error.response?.status,
        responseData: error.response?.data,
      });
      if (error.code === 'ECONNABORTED') {
        throw new Error('Não foi possível realizar o PIX. O Banco Central não respondeu a tempo. Tente novamente mais tarde.');
      }
      const serverMsg = error.response?.data?.error || error.response?.data?.message;
      throw new Error(serverMsg || 'Não foi possível realizar o PIX. Tente novamente mais tarde.');
    }
  },

  /**
   * Retorna histórico de transações de uma conta
   * @param {number} accountId
   * @returns {Promise<Array>} lista de transações
   */
  async getTransactionHistory(accountId, options = {}) {
    try {
      const limit = Number(options.limit || 0);
      const endpoint = limit > 0
        ? `/account/${accountId}/recent?limit=${Math.min(Math.max(limit, 1), 500)}`
        : `/account/${accountId}`;

      // DEBUG: Verificar URL completa
      const fullUrl = transactionApi.defaults.baseURL + endpoint;
      console.log('🔍 URL completa da requisição de histórico:', fullUrl);
      console.log('🔍 BaseURL do transactionApi:', transactionApi.defaults.baseURL);
      console.log('🔍 URL atual da página:', window.location.href);
      console.log('🔍 AccountId:', accountId);
      
      const { data } = await transactionApi.get(endpoint);
      
      console.log('✅ Histórico de transações obtido:', data);
      
      // Transforma os dados para o formato esperado pelo frontend
      const transformedData = data.map(tx => {
        // Determina se é enviado ou recebido baseado no accountOriginId
        const isEnviado = tx.accountOriginId === accountId;
        
        return {
          id: tx.id,
          accountOriginId: tx.accountOriginId,
          accountDestinationId: tx.accountDestinationId,
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
      }).sort((a, b) => {
        const dateA = new Date(a.completedAt || a.createdAt || a.data || 0).getTime();
        const dateB = new Date(b.completedAt || b.createdAt || b.data || 0).getTime();
        if (dateB !== dateA) return dateB - dateA;
        return (b.id || 0) - (a.id || 0);
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

pixService.getRecentTransactionHistory = (accountId, limit = 20) =>
  pixService.getTransactionHistory(accountId, { limit });

export default pixService;
