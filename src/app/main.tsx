import React from 'react';
import ReactDOM from 'react-dom/client';
import { createAppContainer } from '../composition/container';
import { AppProviders } from './providers';
import { App } from './App';
import { createLocalStorageDriver } from '../infrastructure/storage/local-storage/driver';

function runDevLocalResetIfRequested(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);
  const shouldReset = url.searchParams.get('finapp_reset_local') === '1';
  if (!shouldReset) {
    return;
  }

  const storage = createLocalStorageDriver();
  storage.clearNamespace();
  url.searchParams.delete('finapp_reset_local');
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
}

runDevLocalResetIfRequested();

const container = createAppContainer();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppProviders container={container}>
      <App />
    </AppProviders>
  </React.StrictMode>,
);
