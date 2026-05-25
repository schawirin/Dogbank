import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Header from './Header';
import Sidebar from './Sidebar';

const MainLayout = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-200 border-t-purple-600 mx-auto mb-4"></div>
          <p className="text-slate-500 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen bg-[#f1f5f9] overflow-hidden">
      <aside className="w-64 bg-white/70 backdrop-blur-md border-r border-white/40 hidden lg:flex flex-col h-full relative z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <Sidebar />
      </aside>

      <main className="flex-1 flex flex-col h-full relative overflow-y-auto overflow-x-hidden">
        <Header />
        <div className="flex-1 p-4 md:p-8 w-full max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
