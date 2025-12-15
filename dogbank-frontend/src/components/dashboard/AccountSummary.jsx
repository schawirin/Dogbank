import React from 'react';
import Card from '../common/Card';
import Button from '../common/Button';
import { useNavigate } from 'react-router-dom';

const AccountSummary = ({ accountData }) => {
  const navigate = useNavigate();
  
  // Formatar valor para exibição em reais
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };
  
  // Formatar número da conta (0001-9)
  const formatAccountNumber = (accountNumber) => {
    if (!accountNumber) return '';
    
    const cleaned = accountNumber.toString().replace(/\D/g, '');
    const length = cleaned.length;
    
    if (length > 1) {
      const digits = cleaned.slice(0, length - 1);
      const check = cleaned.slice(length - 1);
      return `${digits}-${check}`;
    }
    
    return accountNumber;
  };
  
  const handlePixClick = () => {
    navigate('/app/pix');
  };

  const handleExtractClick = () => {
    navigate('/app/extrato');
  };
  
  return (
    <Card className="mb-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center">
        <div>
          <h2 className="text-lg font-medium text-neutral-600 mb-1">Saldo disponível</h2>
          <div className="flex items-baseline">
            <p className="text-3xl font-semibold">
              {accountData?.saldo ? formatCurrency(accountData.saldo) : 'R$ 0,00'}
            </p>
            <span className="ml-2 text-sm text-neutral-500">
              Conta {accountData?.numero_conta ? formatAccountNumber(accountData.numero_conta) : ''}
            </span>
          </div>
        </div>
        
        <div className="mt-4 md:mt-0 flex space-x-3">
          <Button
            variant="primary"
            onClick={handlePixClick}
          >
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
              </svg>
              Fazer PIX
            </div>
          </Button>
          <Button
            variant="outline"
            onClick={handleExtractClick}
          >
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
              </svg>
              Ver extrato
            </div>
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default AccountSummary;