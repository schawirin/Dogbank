import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

// Layout
import MainLayout from './components/layout/MainLayout';

// Páginas
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import PasswordPage from './pages/PasswordPage';
import DashboardPage from './pages/DashboardPage';
import ExtractPage from './pages/ExtractPage';
import CardsPage from './pages/CardsPage';
import PixTransferPage from './pages/PixTransferPage';
import PixConfirmPage from './pages/PixConfirmPage';
import PixReceiptPage from './pages/PixReceiptPage';
import NotFoundPage from './pages/NotFoundPage';
import ProfilePage from './pages/ProfilePage';

const App = () => (
  <AuthProvider>
    <Routes>
      {/* Rotas públicas */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/password" element={<PasswordPage />} />

      {/* Rotas protegidas dentro do MainLayout */}
      <Route path="/dashboard" element={<MainLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="extrato" element={<ExtractPage />} />
        <Route path="cartoes" element={<CardsPage />} />
        <Route path="perfil" element={<ProfilePage />} />

        {/* Fluxo PIX - rotas aninhadas dentro de /dashboard */}
        <Route path="pix" element={<PixTransferPage />} />
        <Route path="pix/confirm" element={<PixConfirmPage />} />
        <Route path="pix/receipt" element={<PixReceiptPage />} />

        {/* Outros */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Rotas alternativas para compatibilidade com navegação direta */}
      <Route path="/pix" element={<Navigate to="/dashboard/pix" replace />} />
      <Route path="/pix/confirm" element={<Navigate to="/dashboard/pix/confirm" replace />} />
      <Route path="/pix/receipt" element={<Navigate to="/dashboard/pix/receipt" replace />} />
      <Route path="/cartoes" element={<Navigate to="/dashboard/cartoes" replace />} />
      <Route path="/extrato" element={<Navigate to="/dashboard/extrato" replace />} />
      <Route path="/perfil" element={<Navigate to="/dashboard/perfil" replace />} />
      <Route path="/profile" element={<Navigate to="/dashboard/perfil" replace />} />
    </Routes>
  </AuthProvider>
);

export default App;
