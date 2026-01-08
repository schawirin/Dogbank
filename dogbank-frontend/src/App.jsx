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

import { datadogRum } from '@datadog/browser-rum';

datadogRum.init({
    applicationId: '75c8178b-be55-4aa4-a023-47d3efa27538',
    clientToken: 'pub9db46832ed6a466e3a1ab28915ad67cd',
    // `site` refers to the Datadog site parameter of your organization
    // see https://docs.datadoghq.com/getting_started/site/
    site: 'datadoghq.com',
    service: 'dogbank',
    env: 'dogbank',
    // Specify a version number to identify the deployed version of your application in Datadog
    // version: '1.0.0',
    sessionSampleRate: 100,
    sessionReplaySampleRate: 100,
    defaultPrivacyLevel: 'allow',
});

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
    </Routes>
  </AuthProvider>
);

export default App;
