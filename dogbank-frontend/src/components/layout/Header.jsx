import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import dogbankLogo from '../../assets/images/dogbank-logo.png';

const Header = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-primary-500 text-white shadow-nav">
      <div className="container mx-auto px-1 py-2">
        <div className="flex justify-between items-center">
          {/* Logo do DogBank */}
          <Link to="/dashboard" className="flex items-center -ml-20">
            <img src={dogbankLogo} alt="DogBank" className="h-20 w-auto" />
          </Link>
          
          {isAuthenticated ? (
            <div className="flex items-center space-x-6">
              <div className="hidden md:flex items-center space-x-6">
                <Link to="/dashboard" className="text-white hover:text-primary-200 transition-colors">
                  Início
                </Link>
                <Link to="/pix" className="text-white hover:text-primary-200 transition-colors">
                  PIX
                </Link>
                <Link to="/extrato" className="text-white hover:text-primary-200 transition-colors">
                  Extrato
                </Link>
                <Link to="/cartoes" className="text-white hover:text-primary-200 transition-colors">
                  Cartões
                </Link>
              </div>
              
              <div className="relative group">
                <button className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-primary-400 flex items-center justify-center text-sm font-semibold">
                    {user?.nome?.charAt(0)}
                  </div>
                  <span className="hidden md:inline">{user?.nome || 'Usuário'}</span>
                </button>
                
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2 hidden group-hover:block z-10">
                  <Link to="/profile" className="block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100">
                    Meu Perfil
                  </Link>
                  <Link to="/settings" className="block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100">
                    Configurações
                  </Link>
                  <div className="border-t border-neutral-200 my-1"></div>
                  <button 
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
                  >
                    Sair
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-4">
              <Link 
                to="/login" 
                className="px-4 py-2 rounded-lg border border-white text-white hover:bg-white hover:text-primary-500 transition-colors"
              >
                Entrar
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;