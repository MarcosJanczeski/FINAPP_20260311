import type { ReactNode } from 'react';
import type { AppContainer } from '../composition/container';
import { AppContainerProvider } from '../presentation/hooks/useAppContainer';

interface AppProvidersProps {
  container: AppContainer;
  children: ReactNode;
}

export function AppProviders({ container, children }: AppProvidersProps) {
  return <AppContainerProvider container={container}>{children}</AppContainerProvider>;
}
