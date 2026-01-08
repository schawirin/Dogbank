// src/components/dashboard/QuickActions.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../common/Card';
import Button from '../common/Button';

const QuickActions = () => {
  const navigate = useNavigate();

  return (
    <Card title="Ações rápidas">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Button 
          onClick={() => navigate('/pix')} 
          className="flex-1"
        >
          Fazer PIX
        </Button>
        <Button 
          variant="secondary"
          onClick={() => navigate('/extrato')}
          className="flex-1"
        >
          Extrato
        </Button>
        <Button 
          variant="secondary"
          onClick={() => navigate('/cartoes')}
          className="flex-1"
        >
          Cartões
        </Button>
        <Button 
          variant="secondary"
          onClick={() => {/* implementar depois */}}
          className="flex-1"
        >
          Mais
        </Button>
      </div>
    </Card>
  );
};

export default QuickActions;