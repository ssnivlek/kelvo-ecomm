import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User } from '../types';
import { login as apiLogin, register as apiRegister, getProfile } from '../services/api';

const TOKEN_KEY = 'kelvo_ecomm_token';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (!t) {
      setUser(null);
      setToken(null);
      setIsLoading(false);
      return;
    }
    try {
      const profile = await getProfile(t);
      setUser(profile);
      setToken(t);
      window.DD_RUM?.setUser({
        id: profile.email,
        email: profile.email,
        name: profile.name,
      });
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = useCallback(async (email: string, password: string) => {
    const { token: t, user: u } = await apiLogin(email, password);
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    setUser(u);
    window.DD_RUM?.setUser({
      id: u.email,
      email: u.email,
      name: u.name,
    });
    window.DD_RUM?.addAction('auth_login', { email: u.email });
  }, []);

  const register = useCallback(async (email: string, name: string, password: string) => {
    const { token: t, user: u } = await apiRegister(email, name, password);
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    setUser(u);
    window.DD_RUM?.setUser({
      id: u.email,
      email: u.email,
      name: u.name,
    });
    window.DD_RUM?.addAction('auth_register', { email: u.email });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    window.DD_RUM?.clearUser();
    window.DD_RUM?.addAction('auth_logout');
  }, []);

  const value: AuthContextValue = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    isLoading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
