import { useState, useEffect } from 'react';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  picture?: string;
  dailyCount: number;
  dailyLimit: number;
  remaining: number;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        setUser(await res.json() as AuthUser);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchMe(); }, []);

  const signIn = () => {
    window.location.href = '/api/auth/google';
  };

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
  };

  const refresh = () => fetchMe();

  return { user, loading, signIn, signOut, refresh };
}
