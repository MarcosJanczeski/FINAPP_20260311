import { Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ROUTES } from '../../shared/constants/routes';
import { useAuth } from '../hooks/useAuth';
import { useAppContainer } from '../hooks/useAppContainer';

interface RequireGuestProps {
  children: ReactNode;
}

export function RequireGuest({ children }: RequireGuestProps) {
  const container = useAppContainer();
  const { session, isLoading } = useAuth();
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    if (!session) {
      setRedirectTo(null);
      setIsResolving(false);
      return;
    }

    let mounted = true;
    setIsResolving(true);

    (async () => {
      try {
        const setup = await container.useCases.getWelcomeSetup.execute(session.userId);
        const isWelcomeCompleted = Boolean(setup.person && setup.controlCenter);

        if (mounted) {
          setRedirectTo(isWelcomeCompleted ? ROUTES.dashboard : ROUTES.welcome);
        }
      } catch {
        if (mounted) {
          setRedirectTo(ROUTES.welcome);
        }
      } finally {
        if (mounted) {
          setIsResolving(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [container, session]);

  if (isLoading || isResolving) {
    return <main style={{ padding: '1rem' }}>Carregando...</main>;
  }

  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
