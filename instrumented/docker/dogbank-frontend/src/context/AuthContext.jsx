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

    // ✅ CORREÇÃO: Verificar se o token existe E não é undefined/null/vazio
    if (token && token !== 'undefined' && token !== 'null' && userData) {
      try {
        const parsed = JSON.parse(userData);
        // ✅ Verificar se os dados do usuário são válidos
        if (parsed && (parsed.cpf || parsed.accountId)) {
          setUser(parsed);
          setIsAuthenticated(true);
          console.log('✅ Sessão restaurada com sucesso:', parsed.nome || parsed.cpf);
        } else {
          console.warn('⚠️ Dados do usuário inválidos, limpando localStorage');
          localStorage.removeItem('user');
          localStorage.removeItem('token');
        }
      } catch (e) {
        console.error('Erro ao processar dados do usuário:', e);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    } else {
      // Limpar dados inválidos se existirem
      if (token === 'undefined' || token === 'null') {
        localStorage.removeItem('token');
      }
    }

    setLoading(false);
  }, []);

  // Função genérica de login
  const login = (userData, token) => {
    // ✅ CORREÇÃO: Validar os dados antes de salvar
    if (!userData || !token) {
      console.error('❌ Tentativa de login com dados inválidos:', { userData, token });
      return false;
    }

    // espera que userData contenha { cpf, nome, ... }
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    setIsAuthenticated(true);
    console.log('✅ Login realizado com sucesso:', userData.nome || userData.cpf);
    return true;
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
    console.log('🚪 Fazendo logout');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Também limpar os dados do authService
    localStorage.removeItem('cpf');
    localStorage.removeItem('nome');
    localStorage.removeItem('chavePix');
    localStorage.removeItem('accountId');
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
