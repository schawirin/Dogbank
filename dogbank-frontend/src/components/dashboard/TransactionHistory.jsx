// src/components/dashboard/TransactionHistory.jsx
import React from 'react';
import Card from '../common/Card';

const TransactionHistory = ({ transactions = [] }) => {
  // Formatar valor para exibição em reais
  const formatCurrency = (value) => {
    // Garantir que value seja um número
    const numValue = typeof value === 'number' ? value : parseFloat(value || 0);
    
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Math.abs(numValue)); // Usar Math.abs para sempre mostrar valor positivo
  };

  // Formatar data
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).format(date);
    } catch (e) {
      return 'Data indisponível';
    }
  };

  // Determinar se é transação enviada ou recebida
  const getTransactionType = (transaction) => {
    // Verifica por diferentes campos que podem indicar o tipo
    if (transaction.tipo) {
      return transaction.tipo; // 'enviado' ou 'recebido'
    }
    
    // Verifica pela descrição se contém palavras-chave
    const description = (transaction.description || '').toLowerCase();
    if (description.includes('pix para') || description.includes('enviado') || description.includes('transferência para')) {
      return 'enviado';
    }
    if (description.includes('pix recebido') || description.includes('recebido de') || description.includes('de')) {
      return 'recebido';
    }
    
    // Verifica se tem destinatário (indica envio) ou origem (indica recebimento)
    if (transaction.destinatario || transaction.receiverName || transaction.pixKeyDestination) {
      return 'enviado';
    }
    if (transaction.origem || transaction.senderName) {
      return 'recebido';
    }
    
    // Se não tem campo tipo, verifica pelo valor (negativo = enviado, positivo = recebido)
    const amount = typeof transaction.amount === 'number' ? transaction.amount : parseFloat(transaction.amount || 0);
    return amount < 0 ? 'enviado' : 'recebido';
  };

  // Obter descrição da transação
  const getTransactionDescription = (transaction) => {
    // Se já tem descrição, usa ela
    if (transaction.description) {
      return transaction.description;
    }
    
    const type = getTransactionType(transaction);
    if (type === 'enviado') {
      const destinatario = transaction.destinatario || transaction.receiverName || transaction.pixKeyDestination;
      return `PIX enviado para ${destinatario || 'destinatário'}`;
    } else {
      const origem = transaction.origem || transaction.senderName || 'remetente';
      return `PIX recebido de ${origem}`;
    }
  };

  return (
    <Card title="Últimas transações">
      {transactions.length === 0 ? (
        <div className="py-4 px-2 text-center text-neutral-500">
          <p>Nenhuma transação encontrada.</p>
        </div>
      ) : (
        <div className="divide-y divide-neutral-200">
          {transactions.map((transaction, index) => {
            const type = getTransactionType(transaction);
            const isReceived = type === 'recebido';
            const amount = typeof transaction.amount === 'number' ? transaction.amount : parseFloat(transaction.amount || 0);
            
            return (
              <div key={transaction.id || index} className="py-4">
                <div className="flex justify-between">
                  <div>
                    <p className="font-medium">{getTransactionDescription(transaction)}</p>
                    <p className="text-sm text-neutral-500">
                      {formatDate(transaction.date || transaction.createdAt || transaction.completedAt)}
                    </p>
                  </div>
                  <div className={`font-semibold ${isReceived ? 'text-green-600' : 'text-red-600'}`}>
                    {isReceived ? '+' : '-'} {formatCurrency(Math.abs(amount))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export default TransactionHistory;