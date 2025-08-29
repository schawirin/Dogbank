// src/context/AuthContext.jsx
import React, { createContext, useState, useEffect } from 'react';
import authService from '../services/authService'; // ajuste o caminho conforme seu projeto

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Carrega token + user do localStorage na inicialização
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (token && userData) {
      try {
        const parsed = JSON.parse(userData);
        setUser(parsed);
        setIsAuthenticated(true);
      } catch (e) {
        console.error('Erro ao processar dados do usuário:', e);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }

    setLoading(false);
  }, []);

  // Função genérica de login
  const login = (userData, token) => {
    // espera que userData contenha { cpf, nome, ... }
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    setIsAuthenticated(true);
  };

  // Autentica via API (CPF + PIN) e já faz login automático
  const authenticate = async (cpf, pin) => {
    setLoading(true);
    try {
      // sua função no authService deve retornar { token, user }
      const { token, user: userFromApi } = await authService.authenticate({ cpf, pin });
      if (!token || !userFromApi) {
        throw new Error('Resposta inválida de autenticação');
      }
      login(userFromApi, token);
      return userFromApi;
    } finally {
      setLoading(false);
    }
  };

  // Desloga e limpa tudo
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
  };

  // Permite atualizar parcialmente o objeto user (por exemplo, mudar nome ou CPF)
  const updateUser = (newUserData) => {
    const updated = { ...user, ...newUserData };
    localStorage.setItem('user', JSON.stringify(updated));
    setUser(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        loading,
        login,          // caso queira logar manualmente
        authenticate,   // use esse método no fluxo de CPF+PIN
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
