// src/services/authService.js
import { authApi, bancoCentralApi } from './api';

const CPF_KEY         = 'cpf';
const NOME_KEY        = 'nome';
const CHAVE_PIX_KEY   = 'chavePix';
const ACCOUNT_ID_KEY  = 'accountId';

/**
 * Serviço de autenticação e sessão
 */
const authService = {
  /**
   * Faz login usando CPF e senha (PIN).
   * Salva dados no localStorage para uso posterior.
   *
   * @param {string} cpf
   * @param {string} senha
   * @returns {Promise<{ nome: string, chavePix: string, accountId: number }>}
   */
  async login(cpf, senha) {
    try {
      console.log('🔐 Tentando login para CPF:', cpf);
      
      const { data } = await authApi.post('/login', { // ✅ CORRIGIDO: era '/auth/login', agora é só '/login'
        cpf: cpf.trim(),
        senha
      });
      
      console.log('✅ Login bem-sucedido, dados recebidos:', data);

      const { nome, chavePix, accountId } = data;
      if (!nome || !accountId) {
        throw new Error('Resposta de login inválida');
      }

      localStorage.setItem(CPF_KEY, cpf.trim());
      localStorage.setItem(NOME_KEY, nome);
      localStorage.setItem(CHAVE_PIX_KEY, chavePix);
      localStorage.setItem(ACCOUNT_ID_KEY, String(accountId));

      console.log('💾 Dados salvos no localStorage');
      return { nome, chavePix, accountId };
    } catch (err) {
      console.error('❌ Erro no authService.login:', err.response?.data || err.message);
      throw err;
    }
  },

  /**
   * Sai (logout): remove dados de sessão do localStorage
   */
  logout() {
    console.log('🚪 Fazendo logout');
    localStorage.removeItem(CPF_KEY);
    localStorage.removeItem(NOME_KEY);
    localStorage.removeItem(CHAVE_PIX_KEY);
    localStorage.removeItem(ACCOUNT_ID_KEY);
  },

  /**
   * Retorna o CPF salvo (ou null)
   */
  getCpf() {
    return localStorage.getItem(CPF_KEY);
  },

  /**
   * Retorna o nome salvo (ou null)
   */
  getNome() {
    return localStorage.getItem(NOME_KEY);
  },

  /**
   * Retorna a chave PIX salva (ou null)
   */
  getChavePix() {
    return localStorage.getItem(CHAVE_PIX_KEY);
  },

  /**
   * Retorna o accountId salvo (ou null)
   */
  getAccountId() {
    const val = localStorage.getItem(ACCOUNT_ID_KEY);
    return val ? Number(val) : null;
  },

  async validatePassword(cpf, password) {
    const { data } = await authApi.post('/validate-password', {
      cpf: cpf?.trim(),
      password
    });

    return data;
  },

  /**
   * Valida uma chave PIX via Banco Central e busca dados do usuário
   *
   * @param {string} chavePix
   */
  async validatePix(chavePix) {
    try {
      console.log('🔍 Validando PIX:', chavePix);
      
      const { data } = await bancoCentralApi.post('/pix/validate', { // ✅ CORRIGIDO: era '/pix/validate', continua igual
        pixKey: chavePix,
        amount: 0.01
      });

      if (data.status !== 'APPROVED') {
        return { valid: false, message: data.error || 'Chave PIX inválida' };
      }

      try {
        const { data: userData } = await authApi.get(
          `/pix/${encodeURIComponent(chavePix)}` // ✅ CORRIGIDO: era '/auth/pix/', agora é só '/pix/'
        );
        return {
          valid: true,
          user: {
            nome: userData.nome,
            banco: 'DogBank',
            cpf: userData.cpf
          }
        };
      } catch {
        return {
          valid: true,
          user: { nome: 'Usuário PIX', banco: 'DogBank', cpf: '' }
        };
      }
    } catch (err) {
      console.error('❌ Erro ao validar PIX:', err.response?.data || err.message);
      return {
        valid: false,
        message: err.response?.data?.error || 'Erro na validação PIX'
      };
    }
  }
};

export default authService;
