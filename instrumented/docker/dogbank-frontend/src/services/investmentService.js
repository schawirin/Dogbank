import { investmentApi } from './api';

const investmentService = {
  async getProducts() {
    const response = await investmentApi.get('/products');
    return response.data;
  },

  async getPositions(accountId) {
    const response = await investmentApi.get(`/account/${accountId}`);
    return response.data;
  },

  async subscribe({ accountId, cpf, userName, productCode, amount, requestedBy }) {
    const response = await investmentApi.post('/subscribe', {
      accountId,
      cpf,
      userName,
      productCode,
      amount,
      requestedBy,
    });
    return response.data;
  },

  async syncPosition(positionId) {
    const response = await investmentApi.post(`/sync/${positionId}`);
    return response.data;
  },

  async runSync() {
    const response = await investmentApi.post('/sync/run');
    return response.data;
  },
};

export default investmentService;
