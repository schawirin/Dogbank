import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Header from './Header';
import Footer from './Footer';
import Sidebar from './Sidebar';

const MainLayout = () => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-neutral-600">Carregando...</p>
        </div>
      </div>
    );
  }
  
  // Redirecionar para login se não estiver autenticado
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      
      <div className="flex flex-1">
        {/* Sidebar em desktop, oculto em mobile */}
        <aside className="hidden md:block w-64 bg-white border-r border-neutral-200 overflow-auto">
          <Sidebar />
        </aside>
        
        {/* Conteúdo principal */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <div className="container mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
      
      <Footer />
    </div>
  );
};

export default MainLayout;