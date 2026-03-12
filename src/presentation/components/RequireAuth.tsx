import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ROUTES } from '../../shared/constants/routes';
import { useAuth } from '../hooks/useAuth';

interface RequireAuthProps {
  children: ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return <main style={{ padding: '1rem' }}>Carregando...</main>;
  }

  if (!session) {
    return <Navigate to={ROUTES.login} replace />;
  }

  return <>{children}</>;
}
