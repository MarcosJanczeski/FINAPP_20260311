import { expect, test } from '@playwright/test';
import { resolvePlanningEventOperationalSnapshot } from '../src/application/services/planningEventOperationalResolver';

const FINAPP_NAMESPACE = 'finapp.mvp.v1';

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
  | 'revertRecurrenceOccurrenceCancellation'
  | 'getProjectionAvailabilitySummary'
  | 'listLedgerEntries';

interface Session {
  userId: string;
}

interface Recurrence {
  id: string;
  controlCenterId: string;
  description: string;
  dayOfMonth: number;
  direction: 'inflow' | 'outflow';
  amountCents: number;
  status: 'active' | 'inactive';
}

interface PlanningEventLink {
  ledgerEntryId: string;
  relation:
    | 'recognition'
    | 'adjustment'
    | 'settlement'
    | 'settlement_reversal'
    | 'recognition_reversal'
    | 'reversal';
  createdAt: string;
}

interface PlanningEvent {
  id: string;
  sourceType: 'manual' | 'recurrence' | 'budget_margin' | 'payable' | 'receivable' | 'import';
  sourceId: string | null;
  sourceEventKey: string | null;
  description: string;
  type: 'previsto_recorrencia' | 'confirmado_agendado' | 'realizado' | 'previsto_margem';
  status: 'active' | 'confirmed' | 'posted' | 'canceled';
  amountCents: number;
  dueDate: string;
  ledgerLinks: PlanningEventLink[];
}

interface LedgerEntry {
  id: string;
  referenceType: string;
  referenceId: string;
  reversalOf?: string;
}

interface ProjectionSummary {
  windowStart: string;
  windowEnd: string;
  baseBalanceCents: number;
  projectedInflowsCents: number;
  projectedOutflowsCents: number;
  projectedFinalBalanceCents: number;
  consideredEventsCount: number;
}

interface LifecycleStepReport {
  step: string;
  expectedState: string;
  foundState: string;
  activeLedgerRelations: string;
  reversalRefs: string;
  projectionImpact: string;
  status: 'PASS' | 'FAIL';
}

test('recurrence lifecycle journey: previsto > confirmado > realizado > reversoes > cancelamento por periodo', async ({
  page,
}, testInfo) => {
  const lifecycleReport: LifecycleStepReport[] = [];
  await page.addInitScript((namespace: string) => {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith(`${namespace}.`))
      .forEach((key) => window.localStorage.removeItem(key));
  }, FINAPP_NAMESPACE);

  await page.goto('/');

  const nonce = Date.now();
  const email = `lifecycle.${nonce}@finapp.local`;
  const password = '123456';
  const recurrenceDescription = `Recorrencia Lifecycle ${nonce}`;
  const recurrenceSkipDescription = `Recorrencia Skip ${nonce}`;

  const user = await invokeBridge<{ id: string }>(page, 'signUp', { email, password });
  const session = await invokeBridge<Session | null>(page, 'getCurrentSession');
  expect(session?.userId).toBe(user.id);

  const person = await invokeBridge<{ id: string }>(page, 'completeWelcomeProfile', {
    userId: user.id,
    name: 'Usuario Lifecycle',
    personType: 'individual',
    phone: '67999990000',
  });
  const controlCenter = await invokeBridge<{ id: string }>(page, 'createOrUpdatePersonalControlCenter', {
    userId: user.id,
    personId: person.id,
    name: 'Centro Lifecycle',
  });
  const account = await invokeBridge<{ id: string }>(page, 'createAccountWithOpeningBalance', {
    controlCenterId: controlCenter.id,
    name: 'Conta Lifecycle',
    type: 'checking',
    nature: 'asset',
    ledgerAccountId: 'ATIVO:DISPONIBILIDADES',
    openingBalanceCents: 300000,
    createdByUserId: user.id,
  });
  const today = new Date();
  const todayDay = today.getDate();
  const lifecycleBaseDate = toIsoNoonLocal(addDays(today, -1));

  const recurrence = await invokeBridge<Recurrence>(page, 'upsertRecurrence', {
    controlCenterId: controlCenter.id,
    description: recurrenceDescription,
    dayOfMonth: todayDay,
    direction: 'outflow',
    amountCents: 12500,
    status: 'active',
  });
  const recurrenceSkip = await invokeBridge<Recurrence>(page, 'upsertRecurrence', {
    controlCenterId: controlCenter.id,
    description: recurrenceSkipDescription,
    dayOfMonth: todayDay,
    direction: 'outflow',
    amountCents: 21000,
    status: 'active',
  });

  await invokeBridge(page, 'syncPlanningEvents', { controlCenterId: controlCenter.id });
  let events = await loadRecurrenceEvents(page, controlCenter.id, recurrence.id);
  let event = pickCurrentPeriodEvent(events, recurrenceDescription);
  const currentPeriodKey = event.sourceEventKey;

  // 1) previsto
  expect(event.type).toBe('previsto_recorrencia');
  expect(event.status).toBe('active');
  expect(await countActiveBaseLinks(page, controlCenter.id, event, 'recognition')).toBe(0);
  expect(await countActiveBaseLinks(page, controlCenter.id, event, 'settlement')).toBe(0);
  await assertProjectionForCurrentPeriod(
    page,
    controlCenter.id,
    currentPeriodKey,
    'previsto',
    true,
  );
  lifecycleReport.push(
    await buildStepReport(page, controlCenter.id, event, {
      step: '1) previsto',
      expectedState: 'previsto',
      projectionImpact: 'Ocorrência aparece na projeção operacional como previsão.',
      status: 'PASS',
    }),
  );

  // 2) confirmação
  await invokeBridge(page, 'confirmRecurrencePlanningEvent', {
    id: event.id,
    controlCenterId: controlCenter.id,
    confirmedByUserId: user.id,
    documentDate: lifecycleBaseDate,
    dueDate: lifecycleBaseDate,
    plannedSettlementDate: lifecycleBaseDate,
    confirmedAmountCents: event.amountCents,
  });
  events = await loadRecurrenceEvents(page, controlCenter.id, recurrence.id);
  event = findById(events, event.id);
  expect(event.type).toBe('confirmado_agendado');
  expect(event.status).toBe('confirmed');
  expect(await countActiveBaseLinks(page, controlCenter.id, event, 'recognition')).toBe(1);
  expect(await countActiveBaseLinks(page, controlCenter.id, event, 'settlement')).toBe(0);
  await assertNoDuplicateActiveSettlements(page, controlCenter.id, event);
  await assertProjectionForCurrentPeriod(
    page,
    controlCenter.id,
    currentPeriodKey,
    'confirmado',
    true,
  );
  lifecycleReport.push(
    await buildStepReport(page, controlCenter.id, event, {
      step: '2) confirmação',
      expectedState: 'confirmado',
      projectionImpact: 'Ocorrência aparece como compromisso na projeção operacional.',
      status: 'PASS',
    }),
  );

  // 3) liquidação
  await invokeBridge(page, 'settleRecurrencePlanningEvent', {
    id: event.id,
    controlCenterId: controlCenter.id,
    settlementDate: lifecycleBaseDate,
    settlementAmountCents: event.amountCents,
    settlementAccountId: account.id,
    settledByUserId: user.id,
  });
  events = await loadRecurrenceEvents(page, controlCenter.id, recurrence.id);
  event = findById(events, event.id);
  expect(event.type).toBe('realizado');
  expect(event.status).toBe('posted');
  expect(await countActiveBaseLinks(page, controlCenter.id, event, 'recognition')).toBe(1);
  expect(await countActiveBaseLinks(page, controlCenter.id, event, 'settlement')).toBe(1);
  await assertNoDuplicateActiveSettlements(page, controlCenter.id, event);
  await assertProjectionForCurrentPeriod(
    page,
    controlCenter.id,
    currentPeriodKey,
    'realizado',
    true,
  );
  lifecycleReport.push(
    await buildStepReport(page, controlCenter.id, event, {
      step: '3) liquidação',
      expectedState: 'realizado',
      projectionImpact: 'Ocorrência passa para realizado sem dupla contagem de previsão/compromisso.',
      status: 'PASS',
    }),
  );

  // 4) estorno de liquidação -> confirmado
  await invokeBridge(page, 'reverseRecurrenceSettlement', {
    id: event.id,
    controlCenterId: controlCenter.id,
    reversedByUserId: user.id,
  });
  events = await loadRecurrenceEvents(page, controlCenter.id, recurrence.id);
  event = findById(events, event.id);
  expect(event.type).toBe('confirmado_agendado');
  expect(event.status).toBe('confirmed');
  expect(await countActiveBaseLinks(page, controlCenter.id, event, 'settlement')).toBe(0);
  expect(countLinks(event, 'settlement_reversal')).toBeGreaterThan(0);
  await assertAllReversalsHaveSource(page, controlCenter.id, event);
  const ledgerEntriesBeforeSecondReverse = await invokeBridge<LedgerEntry[]>(page, 'listLedgerEntries', {
    controlCenterId: controlCenter.id,
  });
  const linksSnapshotBeforeSecondReverse = JSON.stringify(event.ledgerLinks);
  const secondReverseSettlementError = await expectBridgeFailure(page, 'reverseRecurrenceSettlement', {
    id: event.id,
    controlCenterId: controlCenter.id,
    reversedByUserId: user.id,
  });
  expect(secondReverseSettlementError).toContain('Nao existe liquidacao ativa para estorno.');
  const ledgerEntriesAfterSecondReverse = await invokeBridge<LedgerEntry[]>(page, 'listLedgerEntries', {
    controlCenterId: controlCenter.id,
  });
  expect(ledgerEntriesAfterSecondReverse.length).toBe(ledgerEntriesBeforeSecondReverse.length);
  events = await loadRecurrenceEvents(page, controlCenter.id, recurrence.id);
  event = findById(events, event.id);
  expect(JSON.stringify(event.ledgerLinks)).toBe(linksSnapshotBeforeSecondReverse);
  await assertProjectionForCurrentPeriod(
    page,
    controlCenter.id,
    currentPeriodKey,
    'confirmado',
    true,
  );
  lifecycleReport.push(
    await buildStepReport(page, controlCenter.id, event, {
      step: '4) reverse settlement',
      expectedState: 'confirmado',
      projectionImpact: 'Após estorno da liquidação, ocorrência retorna como compromisso.',
      status: 'PASS',
    }),
  );

  // 5) estorno de confirmação -> previsto
  await invokeBridge(page, 'reverseRecurrenceConfirmation', {
    id: event.id,
    controlCenterId: controlCenter.id,
    reversedByUserId: user.id,
    targetState: 'forecast',
  });
  events = await loadRecurrenceEvents(page, controlCenter.id, recurrence.id);
  event = findById(events, event.id);
  expect(event.type).toBe('previsto_recorrencia');
  expect(event.status).toBe('active');
  expect(await countActiveBaseLinks(page, controlCenter.id, event, 'recognition')).toBe(0);
  expect(await countActiveBaseLinks(page, controlCenter.id, event, 'settlement')).toBe(0);
  expect(countLinks(event, 'recognition_reversal')).toBeGreaterThan(0);
  await assertAllReversalsHaveSource(page, controlCenter.id, event);
  const secondReverseRecognitionError = await expectBridgeFailure(page, 'reverseRecurrenceConfirmation', {
    id: event.id,
    controlCenterId: controlCenter.id,
    reversedByUserId: user.id,
    targetState: 'forecast',
  });
  expect(secondReverseRecognitionError).toContain(
    'Somente recorrencia confirmada ou realizada pode ser ajustada neste fluxo.',
  );
  await assertProjectionForCurrentPeriod(
    page,
    controlCenter.id,
    currentPeriodKey,
    'previsto',
    true,
  );
  lifecycleReport.push(
    await buildStepReport(page, controlCenter.id, event, {
      step: '5) reverse confirmation',
      expectedState: 'previsto',
      projectionImpact: 'Após estorno da confirmação, ocorrência retorna para previsão.',
      status: 'PASS',
    }),
  );

  // 6) nova confirmação
  await invokeBridge(page, 'confirmRecurrencePlanningEvent', {
    id: event.id,
    controlCenterId: controlCenter.id,
    confirmedByUserId: user.id,
    documentDate: lifecycleBaseDate,
    dueDate: lifecycleBaseDate,
    plannedSettlementDate: lifecycleBaseDate,
    confirmedAmountCents: event.amountCents,
  });
  events = await loadRecurrenceEvents(page, controlCenter.id, recurrence.id);
  event = findById(events, event.id);
  expect(event.status).toBe('confirmed');
  expect(await countActiveBaseLinks(page, controlCenter.id, event, 'recognition')).toBe(1);
  await assertProjectionForCurrentPeriod(
    page,
    controlCenter.id,
    currentPeriodKey,
    'confirmado',
    true,
  );
  lifecycleReport.push(
    await buildStepReport(page, controlCenter.id, event, {
      step: '6) nova confirmação',
      expectedState: 'confirmado',
      projectionImpact: 'Reconfirmação recoloca ocorrência como compromisso.',
      status: 'PASS',
    }),
  );

  // 7) nova liquidação
  await invokeBridge(page, 'settleRecurrencePlanningEvent', {
    id: event.id,
    controlCenterId: controlCenter.id,
    settlementDate: lifecycleBaseDate,
    settlementAmountCents: event.amountCents,
    settlementAccountId: account.id,
    settledByUserId: user.id,
  });
  events = await loadRecurrenceEvents(page, controlCenter.id, recurrence.id);
  event = findById(events, event.id);
  expect(event.status).toBe('posted');
  expect(await countActiveBaseLinks(page, controlCenter.id, event, 'settlement')).toBe(1);
  await assertProjectionForCurrentPeriod(
    page,
    controlCenter.id,
    currentPeriodKey,
    'realizado',
    true,
  );
  lifecycleReport.push(
    await buildStepReport(page, controlCenter.id, event, {
      step: '7) nova liquidação',
      expectedState: 'realizado',
      projectionImpact: 'Nova liquidação aplicada sem duplicidade ativa.',
      status: 'PASS',
    }),
  );

  // 8) cancelamento da ocorrência realizada via reversões em cadeia
  await invokeBridge(page, 'reverseRecurrenceConfirmation', {
    id: event.id,
    controlCenterId: controlCenter.id,
    reversedByUserId: user.id,
    targetState: 'canceled',
  });
  events = await loadRecurrenceEvents(page, controlCenter.id, recurrence.id);
  event = findById(events, event.id);
  expect(event.status).toBe('canceled');
  expect(await countActiveBaseLinks(page, controlCenter.id, event, 'recognition')).toBe(0);
  expect(await countActiveBaseLinks(page, controlCenter.id, event, 'settlement')).toBe(0);
  expect(countLinks(event, 'settlement_reversal')).toBeGreaterThan(1);
  expect(countLinks(event, 'recognition_reversal')).toBeGreaterThan(1);
  await assertAllReversalsHaveSource(page, controlCenter.id, event);
  await assertProjectionForCurrentPeriod(page, controlCenter.id, currentPeriodKey, 'cancelado', false);
  lifecycleReport.push(
    await buildStepReport(page, controlCenter.id, event, {
      step: '8) cancelamento do período (cadeia)',
      expectedState: 'cancelado',
      projectionImpact: 'Ocorrência cancelada do período deixa de aparecer na projeção operacional.',
      status: 'PASS',
    }),
  );

  // 9) períodos futuros da recorrência continuam existindo
  await invokeBridge(page, 'syncPlanningEvents', { controlCenterId: controlCenter.id });
  events = await loadRecurrenceEvents(page, controlCenter.id, recurrence.id);
  expect(
    events.filter(
      (item) =>
        item.sourceEventKey === currentPeriodKey &&
        item.status !== 'canceled',
    ).length,
  ).toBe(0);
  const futureEvents = events.filter((item) => item.id !== event.id && item.status === 'active');
  expect(futureEvents.length).toBeGreaterThan(0);
  await assertProjectionFutureContinuity(page, controlCenter.id, recurrence.id, currentPeriodKey);
  lifecycleReport.push({
    step: '9) continuidade futura',
    expectedState: 'futuro ativo',
    foundState: 'futuro ativo',
    activeLedgerRelations: 'N/A',
    reversalRefs: 'N/A',
    projectionImpact: 'Períodos futuros da recorrência permanecem projetados.',
    status: 'PASS',
  });

  // 10) desativação da recorrência: sem reabrir histórico confirmado/realizado e sem dupla contagem ativa
  await invokeBridge(page, 'upsertRecurrence', {
    id: recurrence.id,
    controlCenterId: controlCenter.id,
    description: recurrence.description,
    dayOfMonth: recurrence.dayOfMonth,
    direction: recurrence.direction,
    amountCents: recurrence.amountCents,
    status: 'inactive',
  });
  await invokeBridge(page, 'syncPlanningEvents', { controlCenterId: controlCenter.id });
  events = await loadRecurrenceEvents(page, controlCenter.id, recurrence.id);

  const activeAfterDeactivation = events.filter((item) => item.status === 'active');
  expect(activeAfterDeactivation.length).toBe(0);
  expect(events.some((item) => item.id === event.id && item.status === 'canceled')).toBeTruthy();
  await assertProjectionForCurrentPeriod(page, controlCenter.id, currentPeriodKey, 'cancelado', false);
  lifecycleReport.push({
    step: '10) desativação da recorrência base',
    expectedState: 'sem ativos do período',
    foundState: 'sem ativos do período',
    activeLedgerRelations: 'N/A',
    reversalRefs: 'N/A',
    projectionImpact: 'Somente previstos/cancelados do período são saneados; histórico não é reaberto.',
    status: 'PASS',
  });

  const recurrences = await invokeBridge<Recurrence[]>(page, 'listRecurrences', controlCenter.id);
  const storedRecurrence = recurrences.find((item) => item.id === recurrence.id);
  expect(storedRecurrence?.status).toBe('inactive');

  // Edge case 2) realizado -> reverse settlement -> confirmado -> cancel occurrence (period skip)
  await invokeBridge(page, 'syncPlanningEvents', { controlCenterId: controlCenter.id });
  let skipEvents = await loadRecurrenceEvents(page, controlCenter.id, recurrenceSkip.id);
  let skipEvent = pickCurrentPeriodEvent(skipEvents, recurrenceSkipDescription);
  const skipCurrentPeriodKey = skipEvent.sourceEventKey;
  expect(skipCurrentPeriodKey).toBeTruthy();

  await invokeBridge(page, 'confirmRecurrencePlanningEvent', {
    id: skipEvent.id,
    controlCenterId: controlCenter.id,
    confirmedByUserId: user.id,
    documentDate: lifecycleBaseDate,
    dueDate: lifecycleBaseDate,
    plannedSettlementDate: lifecycleBaseDate,
    confirmedAmountCents: skipEvent.amountCents,
  });
  skipEvents = await loadRecurrenceEvents(page, controlCenter.id, recurrenceSkip.id);
  skipEvent = findById(skipEvents, skipEvent.id);
  expect(skipEvent.status).toBe('confirmed');

  await invokeBridge(page, 'settleRecurrencePlanningEvent', {
    id: skipEvent.id,
    controlCenterId: controlCenter.id,
    settlementDate: lifecycleBaseDate,
    settlementAmountCents: skipEvent.amountCents,
    settlementAccountId: account.id,
    settledByUserId: user.id,
  });
  skipEvents = await loadRecurrenceEvents(page, controlCenter.id, recurrenceSkip.id);
  skipEvent = findById(skipEvents, skipEvent.id);
  expect(skipEvent.status).toBe('posted');

  await invokeBridge(page, 'reverseRecurrenceSettlement', {
    id: skipEvent.id,
    controlCenterId: controlCenter.id,
    reversedByUserId: user.id,
  });
  skipEvents = await loadRecurrenceEvents(page, controlCenter.id, recurrenceSkip.id);
  skipEvent = findById(skipEvents, skipEvent.id);
  expect(skipEvent.status).toBe('confirmed');
  await assertProjectionForCurrentPeriod(
    page,
    controlCenter.id,
    skipCurrentPeriodKey,
    'confirmado',
    true,
  );

  await invokeBridge(page, 'reverseRecurrenceConfirmation', {
    id: skipEvent.id,
    controlCenterId: controlCenter.id,
    reversedByUserId: user.id,
    targetState: 'canceled',
  });
  skipEvents = await loadRecurrenceEvents(page, controlCenter.id, recurrenceSkip.id);
  skipEvent = findById(skipEvents, skipEvent.id);
  expect(skipEvent.status).toBe('canceled');
  expect(countLinks(skipEvent, 'recognition')).toBeGreaterThan(0);
  expect(countLinks(skipEvent, 'settlement')).toBeGreaterThan(0);
  expect(countLinks(skipEvent, 'settlement_reversal')).toBeGreaterThan(0);
  expect(countLinks(skipEvent, 'recognition_reversal')).toBeGreaterThan(0);
  await assertAllReversalsHaveSource(page, controlCenter.id, skipEvent);
  await assertProjectionForCurrentPeriod(
    page,
    controlCenter.id,
    skipCurrentPeriodKey,
    'cancelado',
    false,
  );
  await invokeBridge(page, 'syncPlanningEvents', { controlCenterId: controlCenter.id });
  skipEvents = await loadRecurrenceEvents(page, controlCenter.id, recurrenceSkip.id);
  skipEvent = findById(skipEvents, skipEvent.id);
  expect(skipEvent.status).toBe('canceled');

  await invokeBridge(page, 'revertRecurrenceOccurrenceCancellation', {
    id: skipEvent.id,
    controlCenterId: controlCenter.id,
    revertedByUserId: user.id,
  });
  skipEvents = await loadRecurrenceEvents(page, controlCenter.id, recurrenceSkip.id);
  skipEvent = findById(skipEvents, skipEvent.id);
  expect(skipEvent.status).toBe('active');
  expect(skipEvent.type).toBe('previsto_recorrencia');
  await assertProjectionForCurrentPeriod(
    page,
    controlCenter.id,
    skipCurrentPeriodKey,
    'previsto',
    true,
  );
  await assertProjectionFutureContinuity(page, controlCenter.id, recurrenceSkip.id, skipCurrentPeriodKey);
  lifecycleReport.push(
    await buildStepReport(page, controlCenter.id, skipEvent, {
      step: 'Edge 2) reverse settlement -> cancel skip -> revert cancel',
      expectedState: 'previsto',
      projectionImpact:
        'Após reverter cancelamento, período atual volta para previsto e futuros continuam.',
      status: 'PASS',
    }),
  );

  const recurrencesAfterSkip = await invokeBridge<Recurrence[]>(page, 'listRecurrences', controlCenter.id);
  const storedRecurrenceSkip = recurrencesAfterSkip.find((item) => item.id === recurrenceSkip.id);
  expect(storedRecurrenceSkip?.status).toBe('active');

  await emitLifecycleReport(testInfo, lifecycleReport);
});

async function invokeBridge<T>(page: import('@playwright/test').Page, action: DevBridgeAction, payload?: unknown): Promise<T> {
  const result = await page.evaluate(
    async ({ actionName, body }) => {
      const bridge = (window as Window & { __FINAPP_DEV_BRIDGE__?: { invoke: (action: string, payload?: unknown) => Promise<unknown> } }).__FINAPP_DEV_BRIDGE__;
      if (!bridge) {
        return { ok: false, error: 'Bridge de desenvolvimento indisponivel.' };
      }
      try {
        const data = await bridge.invoke(actionName, body);
        return { ok: true, data };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido no bridge.',
        };
      }
    },
    { actionName: action, body: payload },
  );

  if (!result.ok) {
    throw new Error(`Falha no bridge (${action}): ${result.error}`);
  }

  return result.data as T;
}

async function expectBridgeFailure(
  page: import('@playwright/test').Page,
  action: DevBridgeAction,
  payload?: unknown,
): Promise<string> {
  try {
    await invokeBridge(page, action, payload);
    throw new Error(`Esperava falha no bridge (${action}), mas a execução teve sucesso.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha desconhecida';
    expect(message).toContain(`Falha no bridge (${action}):`);
    return message;
  }
}

async function loadRecurrenceEvents(
  page: import('@playwright/test').Page,
  controlCenterId: string,
  recurrenceId: string,
): Promise<PlanningEvent[]> {
  const all = await invokeBridge<PlanningEvent[]>(page, 'listPlanningEvents', controlCenterId);
  return all
    .filter((event) => event.sourceId === recurrenceId)
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
}

function pickCurrentPeriodEvent(events: PlanningEvent[], description: string): PlanningEvent {
  const target = events.find(
    (event) =>
      event.status === 'active' &&
      event.type === 'previsto_recorrencia' &&
      event.description === description,
  );
  if (!target) {
    throw new Error('Evento previsto de período atual não encontrado.');
  }
  return target;
}

function findById(events: PlanningEvent[], id: string): PlanningEvent {
  const found = events.find((event) => event.id === id);
  if (!found) {
    throw new Error(`Evento ${id} não encontrado.`);
  }
  return found;
}

function countLinks(event: PlanningEvent, relation: PlanningEventLink['relation']): number {
  return event.ledgerLinks.filter((link) => link.relation === relation).length;
}

async function countActiveBaseLinks(
  page: import('@playwright/test').Page,
  controlCenterId: string,
  event: PlanningEvent,
  base: 'recognition' | 'settlement',
): Promise<number> {
  const entries = await invokeBridge<LedgerEntry[]>(page, 'listLedgerEntries', { controlCenterId });
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const snapshot = resolvePlanningEventOperationalSnapshot(event, {
    ledgerEntriesById: byId,
  });
  return base === 'recognition'
    ? snapshot.activeLinksCount.recognition
    : snapshot.activeLinksCount.settlement;
}

async function assertNoDuplicateActiveSettlements(
  page: import('@playwright/test').Page,
  controlCenterId: string,
  event: PlanningEvent,
): Promise<void> {
  expect(await countActiveBaseLinks(page, controlCenterId, event, 'settlement')).toBeLessThanOrEqual(1);
}

async function assertAllReversalsHaveSource(
  page: import('@playwright/test').Page,
  controlCenterId: string,
  event: PlanningEvent,
): Promise<void> {
  const entries = await invokeBridge<LedgerEntry[]>(page, 'listLedgerEntries', { controlCenterId });
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  for (const link of event.ledgerLinks.filter((item) =>
    ['settlement_reversal', 'recognition_reversal', 'reversal'].includes(item.relation),
  )) {
    const reversalEntry = byId.get(link.ledgerEntryId);
    expect(reversalEntry).toBeTruthy();
    expect(reversalEntry?.reversalOf).toBeTruthy();
    if (reversalEntry?.reversalOf) {
      expect(byId.has(reversalEntry.reversalOf)).toBeTruthy();
    }
  }
}

function toIsoNoonLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T12:00:00.000Z`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

async function assertProjectionForCurrentPeriod(
  page: import('@playwright/test').Page,
  controlCenterId: string,
  sourceEventKey: string | null,
  expectedState: 'previsto' | 'confirmado' | 'realizado' | 'cancelado',
  shouldBeVisibleInOperationalList: boolean,
): Promise<void> {
  if (!sourceEventKey) {
    throw new Error('sourceEventKey ausente para validação da projeção.');
  }

  const allEvents = await invokeBridge<PlanningEvent[]>(page, 'listPlanningEvents', controlCenterId);
  const currentPeriodEvents = allEvents.filter((event) => event.sourceEventKey === sourceEventKey);
  const operationalList = currentPeriodEvents.filter((event) => event.status !== 'canceled');

  if (shouldBeVisibleInOperationalList) {
    expect(operationalList.length).toBe(1);
    const current = operationalList[0];
    expect(functionalState(current)).toBe(expectedState);
  } else {
    expect(operationalList.length).toBe(0);
  }

  await assertProjectionAggregates(page, controlCenterId, allEvents);
}

async function assertProjectionFutureContinuity(
  page: import('@playwright/test').Page,
  controlCenterId: string,
  recurrenceId: string,
  currentPeriodKey: string | null,
): Promise<void> {
  const allEvents = await invokeBridge<PlanningEvent[]>(page, 'listPlanningEvents', controlCenterId);
  const futureOperational = allEvents.filter(
    (event) =>
      event.sourceId === recurrenceId &&
      event.sourceEventKey !== currentPeriodKey &&
      event.status !== 'canceled',
  );
  expect(futureOperational.length).toBeGreaterThan(0);
  await assertProjectionAggregates(page, controlCenterId, allEvents);
}

async function assertProjectionAggregates(
  page: import('@playwright/test').Page,
  controlCenterId: string,
  allEvents: PlanningEvent[],
): Promise<void> {
  const summary = await invokeBridge<ProjectionSummary>(
    page,
    'getProjectionAvailabilitySummary',
    controlCenterId,
  );

  const windowStart = new Date(summary.windowStart);
  const windowEnd = new Date(summary.windowEnd);
  const considered = allEvents.filter((event) => {
    if (event.status !== 'active' && event.status !== 'confirmed') {
      return false;
    }
    if (event.type === 'realizado') {
      return false;
    }
    const dueDate = new Date(event.dueDate);
    return dueDate >= windowStart && dueDate <= windowEnd;
  });

  const inflows = considered
    .filter((event) => event.direction === 'inflow')
    .reduce((sum, event) => sum + event.amountCents, 0);
  const outflows = considered
    .filter((event) => event.direction === 'outflow')
    .reduce((sum, event) => sum + event.amountCents, 0);

  expect(summary.consideredEventsCount).toBe(considered.length);
  expect(summary.projectedInflowsCents).toBe(inflows);
  expect(summary.projectedOutflowsCents).toBe(outflows);
  expect(summary.projectedFinalBalanceCents).toBe(
    summary.baseBalanceCents + summary.projectedInflowsCents - summary.projectedOutflowsCents,
  );
}

function functionalState(event: PlanningEvent): 'previsto' | 'confirmado' | 'realizado' | 'cancelado' {
  return resolvePlanningEventOperationalSnapshot(event).state;
}

async function buildStepReport(
  page: import('@playwright/test').Page,
  controlCenterId: string,
  event: PlanningEvent,
  input: {
    step: string;
    expectedState: string;
    projectionImpact: string;
    status: 'PASS' | 'FAIL';
  },
): Promise<LifecycleStepReport> {
  const activeRecognition = await countActiveBaseLinks(page, controlCenterId, event, 'recognition');
  const activeSettlement = await countActiveBaseLinks(page, controlCenterId, event, 'settlement');
  const reversals = event.ledgerLinks
    .filter((link) =>
      ['settlement_reversal', 'recognition_reversal', 'reversal'].includes(link.relation),
    )
    .map((link) => `${link.relation}:${link.ledgerEntryId.slice(0, 8)}`)
    .join(', ');

  return {
    step: input.step,
    expectedState: input.expectedState,
    foundState: functionalState(event),
    activeLedgerRelations: `recognition=${activeRecognition}, settlement=${activeSettlement}`,
    reversalRefs: reversals || '-',
    projectionImpact: input.projectionImpact,
    status: input.status,
  };
}

async function emitLifecycleReport(
  testInfo: import('@playwright/test').TestInfo,
  report: LifecycleStepReport[],
): Promise<void> {
  if (report.length === 0) {
    return;
  }

  const lines = [
    'LIFECYCLE VALIDATION REPORT',
    ...report.map(
      (item) =>
        `${item.status} | ${item.step} | esperado=${item.expectedState} | encontrado=${item.foundState} | ativos=${item.activeLedgerRelations} | reversoes=${item.reversalRefs} | projecao=${item.projectionImpact}`,
    ),
  ];
  const text = `${lines.join('\n')}\n`;
  console.log(text);

  await testInfo.attach('recurrence-lifecycle-report.txt', {
    body: Buffer.from(text, 'utf-8'),
    contentType: 'text/plain',
  });
  await testInfo.attach('recurrence-lifecycle-report.json', {
    body: Buffer.from(`${JSON.stringify(report, null, 2)}\n`, 'utf-8'),
    contentType: 'application/json',
  });
}
