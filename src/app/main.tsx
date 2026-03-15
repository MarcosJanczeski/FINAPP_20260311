import React from 'react';
import ReactDOM from 'react-dom/client';
import type { AppContainer } from '../composition/container';
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
registerDevBridge(container);

function registerDevBridge(appContainer: AppContainer): void {
  if (typeof window === 'undefined') {
    return;
  }

  const isLocalRuntime =
    window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
  if (!isLocalRuntime) {
    return;
  }

  type DevBridgeAction =
    | 'signUp'
    | 'getCurrentSession'
    | 'completeWelcomeProfile'
    | 'createOrUpdatePersonalControlCenter'
    | 'createAccountWithOpeningBalance'
    | 'upsertRecurrence'
    | 'listRecurrences'
    | 'syncPlanningEvents'
    | 'listPlanningEvents'
    | 'confirmRecurrencePlanningEvent'
    | 'settleRecurrencePlanningEvent'
    | 'reverseRecurrenceSettlement'
    | 'reverseRecurrenceConfirmation'
    | 'listLedgerEntries';

  async function invoke(action: DevBridgeAction, payload?: unknown): Promise<unknown> {
    switch (action) {
      case 'signUp':
        return appContainer.useCases.signUp.execute(payload as Parameters<AppContainer['useCases']['signUp']['execute']>[0]);
      case 'getCurrentSession':
        return appContainer.useCases.getCurrentSession.execute();
      case 'completeWelcomeProfile':
        return appContainer.useCases.completeWelcomeProfile.execute(
          payload as Parameters<AppContainer['useCases']['completeWelcomeProfile']['execute']>[0],
        );
      case 'createOrUpdatePersonalControlCenter':
        return appContainer.useCases.createOrUpdatePersonalControlCenter.execute(
          payload as Parameters<AppContainer['useCases']['createOrUpdatePersonalControlCenter']['execute']>[0],
        );
      case 'createAccountWithOpeningBalance':
        return appContainer.useCases.createAccountWithOpeningBalance.execute(
          payload as Parameters<AppContainer['useCases']['createAccountWithOpeningBalance']['execute']>[0],
        );
      case 'upsertRecurrence':
        return appContainer.useCases.upsertRecurrence.execute(
          payload as Parameters<AppContainer['useCases']['upsertRecurrence']['execute']>[0],
        );
      case 'listRecurrences':
        return appContainer.useCases.listRecurrences.execute(
          payload as Parameters<AppContainer['useCases']['listRecurrences']['execute']>[0],
        );
      case 'syncPlanningEvents':
        return appContainer.useCases.syncPlanningEvents.execute(
          payload as Parameters<AppContainer['useCases']['syncPlanningEvents']['execute']>[0],
        );
      case 'listPlanningEvents':
        return appContainer.useCases.listPlanningEvents.execute(
          payload as Parameters<AppContainer['useCases']['listPlanningEvents']['execute']>[0],
        );
      case 'confirmRecurrencePlanningEvent':
        return appContainer.useCases.confirmRecurrencePlanningEvent.execute(
          payload as Parameters<AppContainer['useCases']['confirmRecurrencePlanningEvent']['execute']>[0],
        );
      case 'settleRecurrencePlanningEvent':
        return appContainer.useCases.settleRecurrencePlanningEvent.execute(
          payload as Parameters<AppContainer['useCases']['settleRecurrencePlanningEvent']['execute']>[0],
        );
      case 'reverseRecurrenceSettlement':
        return appContainer.useCases.reverseRecurrenceSettlement.execute(
          payload as Parameters<AppContainer['useCases']['reverseRecurrenceSettlement']['execute']>[0],
        );
      case 'reverseRecurrenceConfirmation':
        return appContainer.useCases.reverseRecurrenceConfirmation.execute(
          payload as Parameters<AppContainer['useCases']['reverseRecurrenceConfirmation']['execute']>[0],
        );
      case 'listLedgerEntries': {
        const { controlCenterId } = payload as { controlCenterId: string };
        return appContainer.repositories.ledgerEntryRepository.listByControlCenter(controlCenterId);
      }
      default:
        throw new Error(`Acao de bridge nao suportada: ${String(action)}`);
    }
  }

  (window as Window & { __FINAPP_DEV_BRIDGE__?: { invoke: typeof invoke } }).__FINAPP_DEV_BRIDGE__ = {
    invoke,
  };
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppProviders container={container}>
      <App />
    </AppProviders>
  </React.StrictMode>,
);
