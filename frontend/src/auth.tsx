import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { storage } from './utils/storage';
import { api, TOKEN_KEY } from './api';

export type User = { id: string; email: string; username: string; created_at: string };

type AuthCtx = {
  user: User | null;
  loading: boolean;
  signup: (email: string, username: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await api<User>('/auth/me');
      setUser(me);
    } catch {
      await storage.removeItem(TOKEN_KEY);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const tok = await storage.getItem<string>(TOKEN_KEY, '');
      if (tok && typeof tok === 'string' && tok.length > 0) {
        await refresh();
      }
      setLoading(false);
    })();
  }, [refresh]);

  const signup = async (email: string, username: string, password: string) => {
    const res = await api<{ token: string; user: User }>('/auth/signup', {
      method: 'POST', body: { email, username, password }, auth: false,
    });
    await storage.setItem(TOKEN_KEY, res.token);
    setUser(res.user);
  };

  const login = async (email: string, password: string) => {
    const res = await api<{ token: string; user: User }>('/auth/login', {
      method: 'POST', body: { email, password }, auth: false,
    });
    await storage.setItem(TOKEN_KEY, res.token);
    setUser(res.user);
  };

  const logout = async () => {
    await storage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, loading, signup, login, logout, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
