import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client.js';
import type { AuthResponse } from '@docsage/shared';

export type UserProfile = AuthResponse['user'];

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, tenantName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('docsage_user');
    return saved ? (JSON.parse(saved) as UserProfile) : null;
  });
  const [token, setTokenState] = useState<string | null>(() => {
    const savedToken = localStorage.getItem('docsage_token');
    if (savedToken) {
      api.setToken(savedToken);
    }
    return savedToken;
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (token) {
      localStorage.setItem('docsage_token', token);
      api.setToken(token);
    } else {
      localStorage.removeItem('docsage_token');
      api.setToken(null);
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('docsage_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('docsage_user');
    }
  }, [user]);

  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await api.login(email, password);
      setUser(response.user);
      setTokenState(response.accessToken);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, tenantName: string): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await api.register(email, password, tenantName);
      setUser(response.user);
      setTokenState(response.accessToken);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setTokenState(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
