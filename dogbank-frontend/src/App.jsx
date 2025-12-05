import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

// Layout
import MainLayout from './components/layout/MainLayout';

// Páginas
import WelcomePage from './pages/WelcomePage';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import PasswordPage from './pages/PasswordPage';
import DashboardPage from './pages/DashboardPage';
import ExtractPage from './pages/ExtractPage';
import CardsPage from './pages/CardsPage';
import PixTransferPage from './pages/PixTransferPage';
import PixConfirmPage from './pages/PixConfirmPage';
import PixReceiptPage from './pages/PixReceiptPage';
import NotFoundPage from './pages/NotFoundPage';

// Modern Styles
import './styles/animations.css';
import './styles/modern-effects.css';

import { datadogRum } from '@datadog/browser-rum';

datadogRum.init({
    applicationId: '75c8178b-be55-4aa4-a023-47d3efa27538',
    clientToken: 'pub9db46832ed6a466e3a1ab28915ad67cd',
    // `site` refers to the Datadog site parameter of your organization
    // see https://docs.datadoghq.com/getting_started/site/
    site: 'datadoghq.com',
    service: 'dogbank',
    env: 'prod',
    // Specify a version number to identify the deployed version of your application in Datadog
    // version: '1.0.0',
    sessionSampleRate: 100,
    sessionReplaySampleRate: 100,
    defaultPrivacyLevel: 'allow',
});

const App = () => (
  <AuthProvider>
    <Routes>
      {/* Página inicial */}
      <Route path="/" element={<WelcomePage />} />

      {/* Rotas públicas */}
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/password" element={<PasswordPage />} />

      {/* Rotas protegidas */}
      <Route path="/app" element={<MainLayout />}>
        <Route index element={<Navigate to="/app/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="extrato" element={<ExtractPage />} />
        <Route path="cartoes" element={<CardsPage />} />     {/* NOVA ROTA */}

        {/* Fluxo PIX */}
        <Route path="pix" element={<PixTransferPage />} />
        <Route path="pix/confirm" element={<PixConfirmPage />} />
        <Route path="pix/receipt" element={<PixReceiptPage />} />

        {/* Outros */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  </AuthProvider>
);

export default App;