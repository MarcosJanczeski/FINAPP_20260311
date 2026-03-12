import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { AppContainer } from '../../composition/container';

const AppContainerContext = createContext<AppContainer | null>(null);

interface AppContainerProviderProps {
  container: AppContainer;
  children: ReactNode;
}

export function AppContainerProvider({ container, children }: AppContainerProviderProps) {
  return (
    <AppContainerContext.Provider value={container}>{children}</AppContainerContext.Provider>
  );
}

export function useAppContainer(): AppContainer {
  const context = useContext(AppContainerContext);

  if (!context) {
    throw new Error('useAppContainer must be used within AppContainerProvider');
  }

  return context;
}
