import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AppContainer } from '../../composition/container';
import type { AuthSessionDTO } from '../../application/dto/AuthSessionDTO';
import { useAppContainer } from './useAppContainer';

interface AuthContextValue {
  session: AuthSessionDTO | null;
  isLoading: boolean;
  login(input: { email: string; password: string }): Promise<void>;
  signUp(input: { email: string; password: string }): Promise<void>;
  logout(): Promise<void>;
  refreshSession(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

async function loadSession(container: AppContainer): Promise<AuthSessionDTO | null> {
  return container.useCases.getCurrentSession.execute();
}

export function AuthProvider({ children }: AuthProviderProps) {
  const container = useAppContainer();
  const [session, setSession] = useState<AuthSessionDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const current = await loadSession(container);
    setSession(current);
  }, [container]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const current = await loadSession(container);
      if (mounted) {
        setSession(current);
        setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [container]);

  const login = useCallback(
    async (input: { email: string; password: string }) => {
      await container.useCases.login.execute(input);
      await refreshSession();
    },
    [container, refreshSession],
  );

  const signUp = useCallback(
    async (input: { email: string; password: string }) => {
      await container.useCases.signUp.execute(input);
      await refreshSession();
    },
    [container, refreshSession],
  );

  const logout = useCallback(async () => {
    await container.useCases.logout.execute();
    setSession(null);
  }, [container]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
      login,
      signUp,
      logout,
      refreshSession,
    }),
    [session, isLoading, login, signUp, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
