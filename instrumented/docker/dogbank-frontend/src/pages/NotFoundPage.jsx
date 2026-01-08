import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/common/Button';

const NotFoundPage = () => {
  const { isAuthenticated } = useAuth();
  
  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full text-center">
          <img src="/logo.svg" alt="DogBank" className="h-16 mx-auto mb-6" />
          
          <h1 className="text-6xl font-bold text-neutral-800 mb-4">404</h1>
          <h2 className="text-2xl font-semibold text-neutral-700 mb-6">Página não encontrada</h2>
          
          <p className="text-neutral-500 mb-8">
            Desculpe, a página que você está procurando não existe ou foi movida.
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4">
            <Button 
              as={Link} 
              to={isAuthenticated ? '/dashboard' : '/login'} 
              variant="primary"
              size="lg"
            >
              {isAuthenticated ? 'Voltar para o Início' : 'Ir para Login'}
            </Button>
            
            <Button 
              as="a" 
              href="mailto:suporte@dogbank.com" 
              variant="outline"
              size="lg"
            >
              Contatar Suporte
            </Button>
          </div>
        </div>
      </div>
      
      <div className="text-center p-4 text-neutral-500 text-sm">
        <p>DogBank © {new Date().getFullYear()} - Todos os direitos reservados</p>
        <p className="mt-1 text-neutral-400">
          Este é um projeto de demonstração. Não é um banco real.
        </p>
      </div>
    </div>
  );
};

export default NotFoundPage;