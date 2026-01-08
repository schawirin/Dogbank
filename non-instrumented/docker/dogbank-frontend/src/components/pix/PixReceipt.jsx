import React, { useRef } from 'react';
import Card from '../common/Card';
import Button from '../common/Button';

// Adicione verificações para garantir que todos os dados estejam presentes
const PixReceipt = ({ transactionData, onClose }) => {
  // Garantir que transactionData exista
  if (!transactionData) {
    console.error('Dados da transação não fornecidos para o comprovante');
    return (
      <Card>
        <div className="text-center p-4">
          <p className="text-red-500">Erro ao carregar comprovante.</p>
          <Button variant="primary" onClick={onClose}>Voltar ao início</Button>
        </div>
      </Card>
    );
  }

  // Resto do código permanece igual
  
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
  
  // Compartilhar comprovante
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Comprovante de PIX - DogBank',
          text: `Comprovante de PIX no valor de ${formatCurrency(transactionData.amount)} para ${transactionData.recipientInfo?.nome || transactionData.pixKey}. ID: ${transactionData.transactionId}`,
        });
      } catch (error) {
        console.error('Erro ao compartilhar:', error);
      }
    } else {
      // Fallback se a API de compartilhamento não estiver disponível
      alert('Funcionalidade de compartilhamento não suportada neste navegador.');
    }
  };
  
  // Simular a impressão do comprovante (abre diálogo de impressão do navegador)
  const handlePrint = () => {
    if (receiptRef.current) {
      const printContents = receiptRef.current.innerHTML;
      const originalContents = document.body.innerHTML;
      
      document.body.innerHTML = `
        <div style="padding: 20px; font-family: Arial, sans-serif;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #774af4; margin: 0;">DogBank</h1>
            <p style="margin: 5px 0;">Comprovante de Transferência PIX</p>
          </div>
          ${printContents}
        </div>
      `;
      
      window.print();
      document.body.innerHTML = originalContents;
    }
  };
  
  return (
    <Card>
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-success bg-opacity-15 rounded-full mb-4">
          <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
        <h2 className="text-xl font-semibold">Transferência realizada!</h2>
        <p className="text-neutral-500 mt-1">
          O seu PIX foi enviado com sucesso.
        </p>
      </div>
      
      <div className="border rounded-lg bg-neutral-50 p-4 mb-6" ref={receiptRef}>
        <div className="space-y-4">
          <div className="flex justify-between">
            <span className="text-neutral-500">Tipo</span>
            <span className="font-medium">Transferência PIX</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-neutral-500">Data e hora</span>
            <span className="font-medium">{formatDate(transactionData.date)}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-neutral-500">ID da transação</span>
            <span className="font-medium">{transactionData.transactionId}</span>
          </div>
          
          <div className="pt-3 border-t border-neutral-200">
            <p className="text-neutral-500 mb-1">Valor</p>
            <p className="text-xl font-semibold">{formatCurrency(transactionData.amount)}</p>
          </div>
          
          <div>
            <p className="text-neutral-500 mb-1">Destinatário</p>
            <p className="font-medium">{transactionData.recipientInfo?.nome || 'Não identificado'}</p>
            <p className="text-sm">{transactionData.recipientInfo?.banco || ''}</p>
            <p className="text-sm text-neutral-500">Chave: {transactionData.pixKey}</p>
          </div>
          
          {transactionData.description && (
            <div>
              <p className="text-neutral-500 mb-1">Descrição</p>
              <p>{transactionData.description}</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex flex-col space-y-3">
        <Button
          variant="outline"
          size="md"
          onClick={handleShare}
          className="flex items-center justify-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path>
          </svg>
          Compartilhar comprovante
        </Button>
        
        <Button
          variant="outline"
          size="md"
          onClick={handlePrint}
          className="flex items-center justify-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
          </svg>
          Imprimir comprovante
        </Button>
        
        <Button
          variant="primary"
          size="lg"
          onClick={onClose}
        >
          Concluir
        </Button>
      </div>
    </Card>
  );
};

export default PixReceipt;