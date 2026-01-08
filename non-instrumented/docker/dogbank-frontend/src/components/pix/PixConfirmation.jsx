import React, { useState } from 'react';
import pixService from '../../services/pixService';
import Card from '../common/Card';
import Button from '../common/Button';
import Alert from '../common/Alert';

const PixConfirmation = ({ transferData, onCancel, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Formatar valor para exibição em reais
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };
  
  // Formatar data e hora
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };
  
  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('Iniciando validação da transferência PIX', transferData);
      
      // Validar a transação no Banco Central
      const validationResponse = await pixService.validatePixKey(
        transferData.pixKey, 
        transferData.amount
      );
      
      console.log('Resposta da validação PIX:', validationResponse);
      
      if (validationResponse.status === 'FAILED') {
        setError(validationResponse.error || 'Erro ao validar a transação PIX.');
        setLoading(false);
        return;
      }
      
      // Realizar a transferência
      const transactionResponse = await pixService.transfer({
        pixKey: transferData.pixKey,
        amount: transferData.amount,
        description: transferData.description,
        sourceAccountId: transferData.accountData.id
      });
      
      console.log('Resposta da transferência PIX:', transactionResponse);
      
      // IMPORTANTE: Adicionar todos os dados necessários para o PixReceipt
      // Garantir que todos os dados cruciais estão incluídos
      const receiptData = {
        ...transactionResponse,
        // Assegurar que os dados existentes no transferData sejam preservados
        pixKey: transferData.pixKey,
        amount: transferData.amount,
        description: transferData.description,
        recipientInfo: transferData.recipientInfo,
        accountData: transferData.accountData,
        // Dados adicionais para o comprovante
        date: new Date().toISOString(),
        transactionId: transactionResponse.id || `PIX${Date.now()}`,
        message: transactionResponse.message || 'Transferência via PIX concluída'
      };
      
      console.log('Dados preparados para o comprovante:', receiptData);
      
      // Callback para a tela de sucesso (comprovante)
      // Este callback deve estar sendo corretamente implementado no componente pai (PixTransferPage)
      onSuccess(receiptData);
    } catch (err) {
      console.error('Erro ao confirmar transferência:', err);
      
      // Verificar se é um erro específico do Banco Central
      if (err.response && err.response.data && err.response.data.errorCode) {
        const bcError = err.response.data;
        setError(`${bcError.error} (${bcError.errorCode})`);
      } else {
        setError('Ocorreu um erro ao processar sua transferência. Tente novamente mais tarde.');
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Validar se temos os dados necessários para mostrar a confirmação
  if (!transferData || !transferData.amount) {
    return (
      <Card>
        <div className="text-center p-4">
          <p className="text-red-500 mb-4">Dados insuficientes para confirmar a transferência.</p>
          <Button 
            variant="primary" 
            onClick={() => onCancel()} 
            size="lg"
          >
            Voltar ao formulário
          </Button>
        </div>
      </Card>
    );
  }
  
  return (
    <Card>
      <h2 className="text-xl font-semibold mb-6">Confirmar transferência</h2>
      
      {error && (
        <Alert 
          type="error" 
          message={error}
          onClose={() => setError('')}
          className="mb-6"
        />
      )}
      
      <div className="space-y-6 mb-8">
        <div>
          <p className="text-sm text-neutral-500 mb-1">Destinatário</p>
          <p className="font-medium">{transferData.recipientInfo?.nome || 'Não identificado'}</p>
          <p className="text-sm text-neutral-600">{transferData.recipientInfo?.banco || transferData.pixKey}</p>
        </div>
        
        <div>
          <p className="text-sm text-neutral-500 mb-1">Valor</p>
          <p className="text-2xl font-semibold">{formatCurrency(transferData.amount)}</p>
        </div>
        
        {transferData.description && (
          <div>
            <p className="text-sm text-neutral-500 mb-1">Descrição</p>
            <p>{transferData.description}</p>
          </div>
        )}
        
        <div>
          <p className="text-sm text-neutral-500 mb-1">Data e hora</p>
          <p>{formatDate(new Date().toISOString())}</p>
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-3 sm:space-y-0">
        <Button
          type="button"
          variant="outline"
          size="lg"
          fullWidth
          onClick={onCancel}
          disabled={loading}
        >
          Voltar
        </Button>
        
        <Button
          type="button"
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleConfirm}
          disabled={loading}
        >
          {loading ? 'Processando...' : 'Confirmar transferência'}
        </Button>
      </div>
    </Card>
  );
};

export default PixConfirmation;