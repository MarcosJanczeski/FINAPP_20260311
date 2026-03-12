import React from 'react';
import ReactDOM from 'react-dom/client';
import { createAppContainer } from '../composition/container';
import { AppProviders } from './providers';
import { App } from './App';

const container = createAppContainer();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppProviders container={container}>
      <App />
    </AppProviders>
  </React.StrictMode>,
);
