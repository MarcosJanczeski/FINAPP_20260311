import { expect, test } from '@playwright/test';

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

test('recurrence lifecycle journey: previsto > confirmado > realizado > reversoes > cancelamento por periodo', async ({
  page,
}) => {
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
  const todayIsoNoon = toIsoNoonUtc(today);

  const recurrence = await invokeBridge<Recurrence>(page, 'upsertRecurrence', {
    controlCenterId: controlCenter.id,
    description: recurrenceDescription,
    dayOfMonth: todayDay,
    direction: 'outflow',
    amountCents: 12500,
    status: 'active',
  });

  await invokeBridge(page, 'syncPlanningEvents', { controlCenterId: controlCenter.id });
  let events = await loadRecurrenceEvents(page, controlCenter.id, recurrence.id);
  let event = pickCurrentPeriodEvent(events, recurrenceDescription);

  // 1) previsto
  expect(event.type).toBe('previsto_recorrencia');
  expect(event.status).toBe('active');
  expect(await countActiveBaseLinks(page, controlCenter.id, event, 'recognition')).toBe(0);
  expect(await countActiveBaseLinks(page, controlCenter.id, event, 'settlement')).toBe(0);

  // 2) confirmação
  await invokeBridge(page, 'confirmRecurrencePlanningEvent', {
    id: event.id,
    controlCenterId: controlCenter.id,
    confirmedByUserId: user.id,
    documentDate: todayIsoNoon,
    dueDate: todayIsoNoon,
    plannedSettlementDate: todayIsoNoon,
    confirmedAmountCents: event.amountCents,
  });
  events = await loadRecurrenceEvents(page, controlCenter.id, recurrence.id);
  event = findById(events, event.id);
  expect(event.type).toBe('confirmado_agendado');
  expect(event.status).toBe('confirmed');
  expect(await countActiveBaseLinks(page, controlCenter.id, event, 'recognition')).toBe(1);
  expect(await countActiveBaseLinks(page, controlCenter.id, event, 'settlement')).toBe(0);
  await assertNoDuplicateActiveSettlements(page, controlCenter.id, event);

  // 3) liquidação
  await invokeBridge(page, 'settleRecurrencePlanningEvent', {
    id: event.id,
    controlCenterId: controlCenter.id,
    settlementDate: todayIsoNoon,
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

  // 6) nova confirmação
  await invokeBridge(page, 'confirmRecurrencePlanningEvent', {
    id: event.id,
    controlCenterId: controlCenter.id,
    confirmedByUserId: user.id,
    documentDate: todayIsoNoon,
    dueDate: todayIsoNoon,
    plannedSettlementDate: todayIsoNoon,
    confirmedAmountCents: event.amountCents,
  });
  events = await loadRecurrenceEvents(page, controlCenter.id, recurrence.id);
  event = findById(events, event.id);
  expect(event.status).toBe('confirmed');
  expect(await countActiveBaseLinks(page, controlCenter.id, event, 'recognition')).toBe(1);

  // 7) nova liquidação
  await invokeBridge(page, 'settleRecurrencePlanningEvent', {
    id: event.id,
    controlCenterId: controlCenter.id,
    settlementDate: todayIsoNoon,
    settlementAmountCents: event.amountCents,
    settlementAccountId: account.id,
    settledByUserId: user.id,
  });
  events = await loadRecurrenceEvents(page, controlCenter.id, recurrence.id);
  event = findById(events, event.id);
  expect(event.status).toBe('posted');
  expect(await countActiveBaseLinks(page, controlCenter.id, event, 'settlement')).toBe(1);

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

  // 9) períodos futuros da recorrência continuam existindo
  await invokeBridge(page, 'syncPlanningEvents', { controlCenterId: controlCenter.id });
  events = await loadRecurrenceEvents(page, controlCenter.id, recurrence.id);
  const futureEvents = events.filter((item) => item.id !== event.id && item.status === 'active');
  expect(futureEvents.length).toBeGreaterThan(0);

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

  const recurrences = await invokeBridge<Recurrence[]>(page, 'listRecurrences', controlCenter.id);
  const storedRecurrence = recurrences.find((item) => item.id === recurrence.id);
  expect(storedRecurrence?.status).toBe('inactive');
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
  const reversalRelation = base === 'recognition' ? 'recognition_reversal' : 'settlement_reversal';
  const acceptedReversals =
    base === 'recognition'
      ? new Set<PlanningEventLink['relation']>([reversalRelation, 'reversal'])
      : new Set<PlanningEventLink['relation']>([reversalRelation]);
  const reversedIds = new Set<string>();

  for (const link of event.ledgerLinks.filter((item) => acceptedReversals.has(item.relation))) {
    const reversalEntry = byId.get(link.ledgerEntryId);
    if (reversalEntry?.reversalOf) {
      reversedIds.add(reversalEntry.reversalOf);
    }
  }

  return event.ledgerLinks.filter(
    (link) => link.relation === base && !reversedIds.has(link.ledgerEntryId),
  ).length;
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

function toIsoNoonUtc(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}T12:00:00.000Z`;
}
