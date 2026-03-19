import { describe, expect, it } from 'vitest';

import { GetProjectionAvailabilitySummaryUseCase } from '../GetProjectionAvailabilitySummaryUseCase';
import { SyncPlanningEventsUseCase } from '../SyncPlanningEventsUseCase';
import type { Account } from '../../../domain/entities/Account';
import type { LedgerEntry } from '../../../domain/entities/LedgerEntry';
import type { PlanningEvent } from '../../../domain/entities/PlanningEvent';
import type { AccountRepository } from '../../../domain/repositories/AccountRepository';
import type { LedgerEntryRepository } from '../../../domain/repositories/LedgerEntryRepository';
import type { PlanningEventRepository } from '../../../domain/repositories/PlanningEventRepository';
import type {
  PlanningEventSourceItem,
  PlanningEventSourceProvider,
} from '../../services/PlanningEventSourceProvider';
import type { PlanningEventLedgerLink } from '../../../domain/entities/PlanningEvent';

class InMemoryAccountRepository implements AccountRepository {
  constructor(private readonly accounts: Account[]) {}

  async getById(id: string): Promise<Account | null> {
    return this.accounts.find((account) => account.id === id) ?? null;
  }

  async listByControlCenter(controlCenterId: string): Promise<Account[]> {
    return this.accounts.filter((account) => account.controlCenterId === controlCenterId);
  }

  async save(account: Account): Promise<void> {
    const index = this.accounts.findIndex((current) => current.id === account.id);
    if (index >= 0) {
      this.accounts[index] = account;
      return;
    }
    this.accounts.push(account);
  }

  async delete(id: string): Promise<void> {
    const index = this.accounts.findIndex((account) => account.id === id);
    if (index >= 0) {
      this.accounts.splice(index, 1);
    }
  }
}

class InMemoryLedgerEntryRepository implements LedgerEntryRepository {
  constructor(private readonly entries: LedgerEntry[]) {}

  async getById(id: string): Promise<LedgerEntry | null> {
    return this.entries.find((entry) => entry.id === id) ?? null;
  }

  async listByControlCenter(controlCenterId: string): Promise<LedgerEntry[]> {
    return this.entries.filter((entry) => entry.controlCenterId === controlCenterId);
  }

  async save(entry: LedgerEntry): Promise<void> {
    const index = this.entries.findIndex((current) => current.id === entry.id);
    if (index >= 0) {
      this.entries[index] = entry;
      return;
    }
    this.entries.push(entry);
  }
}

class InMemoryPlanningEventRepository implements PlanningEventRepository {
  constructor(private readonly events: PlanningEvent[]) {}

  async getById(id: string): Promise<PlanningEvent | null> {
    return this.events.find((event) => event.id === id) ?? null;
  }

  async listByControlCenter(controlCenterId: string): Promise<PlanningEvent[]> {
    return this.events.filter((event) => event.controlCenterId === controlCenterId);
  }

  async save(event: PlanningEvent): Promise<void> {
    const index = this.events.findIndex((current) => current.id === event.id);
    if (index >= 0) {
      this.events[index] = event;
      return;
    }
    this.events.push(event);
  }
}

class StubPlanningEventSourceProvider implements PlanningEventSourceProvider {
  constructor(private readonly items: PlanningEventSourceItem[]) {}

  async list(): Promise<PlanningEventSourceItem[]> {
    return this.items;
  }
}

class MutablePlanningEventSourceProvider implements PlanningEventSourceProvider {
  constructor(private items: PlanningEventSourceItem[]) {}

  setItems(items: PlanningEventSourceItem[]): void {
    this.items = items;
  }

  async list(): Promise<PlanningEventSourceItem[]> {
    return this.items;
  }
}

const CONTROL_CENTER_ID = 'cc-projection';
const AVAILABILITY_LEDGER_ACCOUNT_ID = 'ledger-disp';

function isoDateFromToday(daysFromNow: number): string {
  const now = new Date();
  const utcNoon = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysFromNow, 12, 0, 0),
  );
  return utcNoon.toISOString();
}

function createAvailabilityAccount(): Account {
  return {
    id: 'acc-1',
    controlCenterId: CONTROL_CENTER_ID,
    name: 'Conta Disponibilidades',
    type: 'checking',
    nature: 'asset',
    ledgerAccountId: AVAILABILITY_LEDGER_ACCOUNT_ID,
    openingBalanceCents: 0,
    status: 'active',
    closedAt: null,
    createdAt: isoDateFromToday(-30),
    updatedAt: isoDateFromToday(-30),
  };
}

function createOpeningLedgerEntry(balanceCents: number): LedgerEntry {
  return {
    id: 'le-opening',
    controlCenterId: CONTROL_CENTER_ID,
    date: isoDateFromToday(-1),
    description: 'Saldo base',
    referenceType: 'account_opening',
    referenceId: 'acc-1',
    lines: [
      {
        ledgerAccountId: AVAILABILITY_LEDGER_ACCOUNT_ID,
        debitCents: balanceCents,
        creditCents: 0,
      },
      {
        ledgerAccountId: 'pl-saldos-iniciais',
        debitCents: 0,
        creditCents: balanceCents,
      },
    ],
    createdAt: isoDateFromToday(-1),
  };
}

function createPlanningEvent(
  overrides: Partial<PlanningEvent> & Pick<PlanningEvent, 'id' | 'description'>,
): PlanningEvent {
  return {
    id: overrides.id,
    controlCenterId: overrides.controlCenterId ?? CONTROL_CENTER_ID,
    date: overrides.date ?? isoDateFromToday(1),
    documentDate: overrides.documentDate ?? isoDateFromToday(0),
    dueDate: overrides.dueDate ?? isoDateFromToday(2),
    plannedSettlementDate: overrides.plannedSettlementDate ?? isoDateFromToday(2),
    settlementDate: overrides.settlementDate ?? null,
    isVerified: overrides.isVerified ?? false,
    verifiedAt: overrides.verifiedAt ?? null,
    verifiedByUserId: overrides.verifiedByUserId ?? null,
    description: overrides.description,
    type: overrides.type ?? 'confirmado_agendado',
    status: overrides.status ?? 'confirmed',
    direction: overrides.direction ?? 'outflow',
    amountCents: overrides.amountCents ?? 100,
    sourceType: overrides.sourceType ?? 'recurrence',
    sourceId: overrides.sourceId ?? 'src-1',
    sourceEventKey: overrides.sourceEventKey ?? overrides.id,
    ledgerLinks: overrides.ledgerLinks ?? [],
    postedLedgerEntryId: overrides.postedLedgerEntryId ?? null,
    createdAt: overrides.createdAt ?? isoDateFromToday(-2),
    updatedAt: overrides.updatedAt ?? isoDateFromToday(-2),
  };
}

function createLedgerLink(
  relation: PlanningEventLedgerLink['relation'],
  suffix: string,
): PlanningEventLedgerLink {
  return {
    relation,
    ledgerEntryId: `le-${relation}-${suffix}`,
    createdAt: isoDateFromToday(-1),
  };
}

function createProjectionSummaryUseCase(input: {
  openingBalanceCents: number;
  events: PlanningEvent[];
  accounts?: Account[];
}): GetProjectionAvailabilitySummaryUseCase {
  const accountRepository = new InMemoryAccountRepository(input.accounts ?? [createAvailabilityAccount()]);
  const ledgerEntryRepository = new InMemoryLedgerEntryRepository([
    createOpeningLedgerEntry(input.openingBalanceCents),
  ]);
  const planningEventRepository = new InMemoryPlanningEventRepository(input.events);

  return new GetProjectionAvailabilitySummaryUseCase(
    accountRepository,
    ledgerEntryRepository,
    planningEventRepository,
  );
}

describe('Projection reliability contract (application integration)', () => {
  it('usa settlementDate como data de fluxo quando presente (cashFlowDate)', async () => {
    const useCase = createProjectionSummaryUseCase({
      openingBalanceCents: 10_000,
      events: [
        createPlanningEvent({
          id: 'ev-outflow-late',
          description: 'Pagamento com liquidação adiada',
          direction: 'outflow',
          amountCents: 9_000,
          plannedSettlementDate: isoDateFromToday(1),
          settlementDate: isoDateFromToday(5),
        }),
        createPlanningEvent({
          id: 'ev-inflow-mid',
          description: 'Recebimento intermediário',
          direction: 'inflow',
          amountCents: 5_000,
          plannedSettlementDate: isoDateFromToday(2),
        }),
      ],
    });

    const summary = await useCase.execute(CONTROL_CENTER_ID);

    expect(summary.projectedFinalBalanceCents).toBe(6_000);
    expect(summary.lowestProjectedBalanceCents).toBe(6_000);
    expect(summary.projectedInflowsCents).toBe(5_000);
    expect(summary.projectedOutflowsCents).toBe(9_000);
  });

  it('isola cenário cartão vs fatura sem antecipar saída de caixa por evento já realizado', async () => {
    const useCase = createProjectionSummaryUseCase({
      openingBalanceCents: 10_000,
      events: [
        createPlanningEvent({
          id: 'card-purchase-realized',
          description: 'Compra no cartão (histórico já realizado)',
          sourceType: 'payable',
          type: 'realizado',
          status: 'posted',
          direction: 'outflow',
          amountCents: 3_000,
          plannedSettlementDate: isoDateFromToday(1),
          settlementDate: isoDateFromToday(1),
        }),
        createPlanningEvent({
          id: 'card-invoice-confirmed',
          description: 'Liquidação da fatura',
          sourceType: 'payable',
          type: 'confirmado_agendado',
          status: 'confirmed',
          direction: 'outflow',
          amountCents: 3_000,
          plannedSettlementDate: isoDateFromToday(10),
        }),
      ],
    });

    const summary = await useCase.execute(CONTROL_CENTER_ID);

    expect(summary.consideredEventsCount).toBe(1);
    expect(summary.projectedOutflowsCents).toBe(3_000);
    expect(summary.projectedFinalBalanceCents).toBe(7_000);
  });

  it('evita dupla contagem quando coexistem versões confirmada e realizada da mesma ocorrência', async () => {
    const sourceEventKey = 'rec-2026-03-10';
    const useCase = createProjectionSummaryUseCase({
      openingBalanceCents: 8_000,
      events: [
        createPlanningEvent({
          id: 'occ-confirmed',
          sourceEventKey,
          description: 'Ocorrência confirmada',
          type: 'confirmado_agendado',
          status: 'confirmed',
          direction: 'outflow',
          amountCents: 1_500,
          plannedSettlementDate: isoDateFromToday(3),
        }),
        createPlanningEvent({
          id: 'occ-realized',
          sourceEventKey,
          description: 'Ocorrência realizada',
          type: 'realizado',
          status: 'posted',
          direction: 'outflow',
          amountCents: 1_500,
          settlementDate: isoDateFromToday(3),
          plannedSettlementDate: isoDateFromToday(3),
        }),
      ],
    });

    const summary = await useCase.execute(CONTROL_CENTER_ID);

    expect(summary.consideredEventsCount).toBe(1);
    expect(summary.projectedOutflowsCents).toBe(1_500);
    expect(summary.projectedFinalBalanceCents).toBe(6_500);
  });

  it('mantém impacto líquido correto em recognition -> settlement -> settlement_reversal', async () => {
    const sourceEventKey = 'chain-settlement-reversal';
    const useCase = createProjectionSummaryUseCase({
      openingBalanceCents: 9_000,
      events: [
        createPlanningEvent({
          id: 'chain-historic-realized',
          sourceEventKey,
          description: 'Histórico realizado antes do estorno da liquidação',
          type: 'realizado',
          status: 'posted',
          direction: 'outflow',
          amountCents: 2_000,
          settlementDate: isoDateFromToday(1),
          plannedSettlementDate: isoDateFromToday(1),
          ledgerLinks: [createLedgerLink('recognition', '1'), createLedgerLink('settlement', '1')],
        }),
        createPlanningEvent({
          id: 'chain-current-confirmed',
          sourceEventKey,
          description: 'Compromisso reaberto após estorno da liquidação',
          type: 'confirmado_agendado',
          status: 'confirmed',
          direction: 'outflow',
          amountCents: 2_000,
          plannedSettlementDate: isoDateFromToday(4),
          ledgerLinks: [
            createLedgerLink('recognition', '2'),
            createLedgerLink('settlement', '2'),
            createLedgerLink('settlement_reversal', '2'),
          ],
        }),
      ],
    });

    const summary = await useCase.execute(CONTROL_CENTER_ID);

    expect(summary.consideredEventsCount).toBe(1);
    expect(summary.projectedOutflowsCents).toBe(2_000);
    expect(summary.projectedFinalBalanceCents).toBe(7_000);
  });

  it('remove impacto projetado em recognition -> recognition_reversal', async () => {
    const useCase = createProjectionSummaryUseCase({
      openingBalanceCents: 7_500,
      events: [
        createPlanningEvent({
          id: 'recognition-reversed',
          description: 'Compromisso revertido',
          type: 'previsto_recorrencia',
          status: 'canceled',
          direction: 'outflow',
          amountCents: 1_200,
          ledgerLinks: [
            createLedgerLink('recognition', '3'),
            createLedgerLink('recognition_reversal', '3'),
          ],
        }),
      ],
    });

    const summary = await useCase.execute(CONTROL_CENTER_ID);

    expect(summary.consideredEventsCount).toBe(0);
    expect(summary.projectedOutflowsCents).toBe(0);
    expect(summary.projectedFinalBalanceCents).toBe(7_500);
  });

  it('não reintroduz impacto quando há recognition -> settlement -> recognition_reversal', async () => {
    const useCase = createProjectionSummaryUseCase({
      openingBalanceCents: 6_800,
      events: [
        createPlanningEvent({
          id: 'canceled-after-full-chain',
          description: 'Ocorrência cancelada após cadeia de reversões',
          type: 'previsto_recorrencia',
          status: 'canceled',
          direction: 'outflow',
          amountCents: 1_800,
          plannedSettlementDate: isoDateFromToday(2),
          ledgerLinks: [
            createLedgerLink('recognition', '4'),
            createLedgerLink('settlement', '4'),
            createLedgerLink('settlement_reversal', '4'),
            createLedgerLink('recognition_reversal', '4'),
          ],
        }),
      ],
    });

    const summary = await useCase.execute(CONTROL_CENTER_ID);

    expect(summary.consideredEventsCount).toBe(0);
    expect(summary.projectedInflowsCents).toBe(0);
    expect(summary.projectedOutflowsCents).toBe(0);
    expect(summary.projectedFinalBalanceCents).toBe(6_800);
  });

  it('reflete reversão posterior de settlement com nova saída futura sem duplicação', async () => {
    const sourceEventKey = 'settled-then-reversed-later';
    const useCase = createProjectionSummaryUseCase({
      openingBalanceCents: 10_000,
      events: [
        createPlanningEvent({
          id: 'historic-realized',
          sourceEventKey,
          description: 'Liquidação original já realizada',
          type: 'realizado',
          status: 'posted',
          direction: 'outflow',
          amountCents: 2_500,
          settlementDate: isoDateFromToday(-2),
          plannedSettlementDate: isoDateFromToday(-2),
          ledgerLinks: [createLedgerLink('recognition', '5'), createLedgerLink('settlement', '5')],
        }),
        createPlanningEvent({
          id: 'future-reopened-confirmed',
          sourceEventKey,
          description: 'Compromisso reaberto para nova liquidação futura',
          type: 'confirmado_agendado',
          status: 'confirmed',
          direction: 'outflow',
          amountCents: 2_500,
          plannedSettlementDate: isoDateFromToday(6),
          ledgerLinks: [
            createLedgerLink('recognition', '6'),
            createLedgerLink('settlement', '6'),
            createLedgerLink('settlement_reversal', '6'),
          ],
        }),
      ],
    });

    const summary = await useCase.execute(CONTROL_CENTER_ID);

    expect(summary.consideredEventsCount).toBe(1);
    expect(summary.projectedOutflowsCents).toBe(2_500);
    expect(summary.projectedFinalBalanceCents).toBe(7_500);
    expect(summary.lowestProjectedBalanceCents).toBe(7_500);
  });

  it('mantém saldo final projetado consistente com a soma algébrica de entradas e saídas', async () => {
    const useCase = createProjectionSummaryUseCase({
      openingBalanceCents: 5_000,
      events: [
        createPlanningEvent({
          id: 'in-1',
          description: 'Entrada 1',
          direction: 'inflow',
          amountCents: 1_000,
          plannedSettlementDate: isoDateFromToday(1),
        }),
        createPlanningEvent({
          id: 'in-2',
          description: 'Entrada 2',
          direction: 'inflow',
          amountCents: 700,
          plannedSettlementDate: isoDateFromToday(2),
        }),
        createPlanningEvent({
          id: 'out-1',
          description: 'Saída 1',
          direction: 'outflow',
          amountCents: 300,
          plannedSettlementDate: isoDateFromToday(2),
        }),
        createPlanningEvent({
          id: 'out-2',
          description: 'Saída 2',
          direction: 'outflow',
          amountCents: 200,
          plannedSettlementDate: isoDateFromToday(4),
        }),
      ],
    });

    const summary = await useCase.execute(CONTROL_CENTER_ID);

    expect(summary.projectedInflowsCents).toBe(1_700);
    expect(summary.projectedOutflowsCents).toBe(500);
    expect(summary.projectedFinalBalanceCents).toBe(6_200);
    expect(summary.projectedFinalBalanceCents).toBe(
      summary.baseBalanceCents + summary.projectedInflowsCents - summary.projectedOutflowsCents,
    );
  });

  it('preserva idempotência de sync/reprocessamento para totais de projeção', async () => {
    const planningEventRepository = new InMemoryPlanningEventRepository([]);
    const sourceProvider = new StubPlanningEventSourceProvider([
      {
        sourceType: 'recurrence',
        sourceId: 'rec-1',
        sourceEventKey: 'rec-1-2026-03-10',
        documentDate: isoDateFromToday(0),
        dueDate: isoDateFromToday(1),
        plannedSettlementDate: isoDateFromToday(1),
        description: 'Recorrência 1',
        type: 'previsto_recorrencia',
        status: 'active',
        direction: 'outflow',
        amountCents: 2_000,
      },
      {
        sourceType: 'recurrence',
        sourceId: 'rec-2',
        sourceEventKey: 'rec-2-2026-03-11',
        documentDate: isoDateFromToday(0),
        dueDate: isoDateFromToday(2),
        plannedSettlementDate: isoDateFromToday(2),
        description: 'Recorrência 2',
        type: 'previsto_recorrencia',
        status: 'active',
        direction: 'inflow',
        amountCents: 1_000,
      },
      {
        sourceType: 'recurrence',
        sourceId: 'rec-1-dupe',
        sourceEventKey: 'rec-1-2026-03-10',
        documentDate: isoDateFromToday(0),
        dueDate: isoDateFromToday(1),
        plannedSettlementDate: isoDateFromToday(1),
        description: 'Recorrência 1 (duplicada)',
        type: 'previsto_recorrencia',
        status: 'active',
        direction: 'outflow',
        amountCents: 2_000,
      },
    ]);

    const syncUseCase = new SyncPlanningEventsUseCase(planningEventRepository, [sourceProvider]);
    const accountRepository = new InMemoryAccountRepository([createAvailabilityAccount()]);
    const ledgerEntryRepository = new InMemoryLedgerEntryRepository([createOpeningLedgerEntry(4_000)]);
    const summaryUseCase = new GetProjectionAvailabilitySummaryUseCase(
      accountRepository,
      ledgerEntryRepository,
      planningEventRepository,
    );

    await syncUseCase.execute({ controlCenterId: CONTROL_CENTER_ID });
    const firstSummary = await summaryUseCase.execute(CONTROL_CENTER_ID);

    await syncUseCase.execute({ controlCenterId: CONTROL_CENTER_ID });
    const secondSummary = await summaryUseCase.execute(CONTROL_CENTER_ID);

    const eventsAfterSecondSync = await planningEventRepository.listByControlCenter(CONTROL_CENTER_ID);
    const uniqueActiveBySourceKey = new Map(
      eventsAfterSecondSync
        .filter((event) => event.status !== 'canceled' && event.sourceEventKey)
        .map((event) => [event.sourceEventKey as string, event.id]),
    );

    expect(eventsAfterSecondSync.filter((event) => event.status !== 'canceled')).toHaveLength(2);
    expect(uniqueActiveBySourceKey.size).toBe(2);
    expect(secondSummary).toEqual(firstSummary);
  });

  it('mantém estabilidade em reversal -> sync -> sync sem duplicar sourceEventKey ativo', async () => {
    const sourceEventKey = 'reversal-sync-stability';
    const provider = new MutablePlanningEventSourceProvider([
      {
        sourceType: 'recurrence',
        sourceId: 'rec-stability',
        sourceEventKey,
        documentDate: isoDateFromToday(0),
        dueDate: isoDateFromToday(1),
        plannedSettlementDate: isoDateFromToday(5),
        description: 'Compromisso recorrente',
        type: 'previsto_recorrencia',
        status: 'active',
        direction: 'outflow',
        amountCents: 1_000,
      },
    ]);
    const planningEventRepository = new InMemoryPlanningEventRepository([]);
    const syncUseCase = new SyncPlanningEventsUseCase(planningEventRepository, [provider]);
    const summaryUseCase = new GetProjectionAvailabilitySummaryUseCase(
      new InMemoryAccountRepository([createAvailabilityAccount()]),
      new InMemoryLedgerEntryRepository([createOpeningLedgerEntry(5_000)]),
      planningEventRepository,
    );

    await syncUseCase.execute({ controlCenterId: CONTROL_CENTER_ID });
    const [created] = await planningEventRepository.listByControlCenter(CONTROL_CENTER_ID);

    await planningEventRepository.save({
      ...created,
      type: 'confirmado_agendado',
      status: 'confirmed',
      plannedSettlementDate: isoDateFromToday(7),
      ledgerLinks: [
        createLedgerLink('recognition', 'sync-a'),
        createLedgerLink('settlement', 'sync-a'),
        createLedgerLink('settlement_reversal', 'sync-a'),
      ],
      updatedAt: isoDateFromToday(0),
    });

    provider.setItems([
      {
        sourceType: 'recurrence',
        sourceId: 'rec-stability',
        sourceEventKey,
        documentDate: isoDateFromToday(0),
        dueDate: isoDateFromToday(1),
        plannedSettlementDate: isoDateFromToday(5),
        description: 'Compromisso recorrente',
        type: 'previsto_recorrencia',
        status: 'active',
        direction: 'outflow',
        amountCents: 1_000,
      },
    ]);

    await syncUseCase.execute({ controlCenterId: CONTROL_CENTER_ID });
    const summaryAfterFirstResync = await summaryUseCase.execute(CONTROL_CENTER_ID);

    await syncUseCase.execute({ controlCenterId: CONTROL_CENTER_ID });
    const summaryAfterSecondResync = await summaryUseCase.execute(CONTROL_CENTER_ID);

    const events = await planningEventRepository.listByControlCenter(CONTROL_CENTER_ID);
    const activeEvents = events.filter((event) => event.status !== 'canceled');
    const uniqueActiveBySourceKey = new Set(
      activeEvents
        .filter((event) => event.sourceEventKey)
        .map((event) => event.sourceEventKey as string),
    );

    expect(activeEvents).toHaveLength(1);
    expect(uniqueActiveBySourceKey.size).toBe(1);
    expect(summaryAfterFirstResync).toEqual(summaryAfterSecondResync);
    expect(summaryAfterSecondResync.projectedOutflowsCents).toBe(1_000);
    expect(summaryAfterSecondResync.consideredEventsCount).toBe(1);
  });

  it('evita inflação bruta quando saldo final coincide por compensação acidental', async () => {
    const useCase = createProjectionSummaryUseCase({
      openingBalanceCents: 1_000,
      events: [
        createPlanningEvent({
          id: 'in-confirmed',
          sourceEventKey: 'sem-dup-in',
          description: 'Entrada confirmada',
          type: 'confirmado_agendado',
          status: 'confirmed',
          direction: 'inflow',
          amountCents: 400,
          plannedSettlementDate: isoDateFromToday(2),
        }),
        createPlanningEvent({
          id: 'in-realized-history',
          sourceEventKey: 'sem-dup-in',
          description: 'Entrada realizada (histórico)',
          type: 'realizado',
          status: 'posted',
          direction: 'inflow',
          amountCents: 400,
          plannedSettlementDate: isoDateFromToday(1),
          settlementDate: isoDateFromToday(1),
        }),
        createPlanningEvent({
          id: 'out-confirmed',
          sourceEventKey: 'sem-dup-out',
          description: 'Saída confirmada',
          type: 'confirmado_agendado',
          status: 'confirmed',
          direction: 'outflow',
          amountCents: 400,
          plannedSettlementDate: isoDateFromToday(3),
        }),
        createPlanningEvent({
          id: 'out-realized-history',
          sourceEventKey: 'sem-dup-out',
          description: 'Saída realizada (histórico)',
          type: 'realizado',
          status: 'posted',
          direction: 'outflow',
          amountCents: 400,
          plannedSettlementDate: isoDateFromToday(1),
          settlementDate: isoDateFromToday(1),
        }),
      ],
    });

    const summary = await useCase.execute(CONTROL_CENTER_ID);

    expect(summary.projectedFinalBalanceCents).toBe(1_000);
    expect(summary.projectedInflowsCents).toBe(400);
    expect(summary.projectedOutflowsCents).toBe(400);
    expect(summary.consideredEventsCount).toBe(2);
  });

  it('respeita ordem por cashFlowDate no menor saldo com reabertura futura e evento intermediário', async () => {
    const sourceEventKey = 'lowest-cashflow-order';
    const useCase = createProjectionSummaryUseCase({
      openingBalanceCents: 1_000,
      events: [
        createPlanningEvent({
          id: 'historic-realized-reopened',
          sourceEventKey,
          description: 'Ocorrência já liquidada no passado',
          type: 'realizado',
          status: 'posted',
          direction: 'outflow',
          amountCents: 900,
          dueDate: isoDateFromToday(1),
          plannedSettlementDate: isoDateFromToday(1),
          settlementDate: isoDateFromToday(-3),
          ledgerLinks: [createLedgerLink('recognition', 'low-1'), createLedgerLink('settlement', 'low-1')],
        }),
        createPlanningEvent({
          id: 'reopened-future-confirmed',
          sourceEventKey,
          description: 'Compromisso reaberto para pagamento futuro',
          type: 'confirmado_agendado',
          status: 'confirmed',
          direction: 'outflow',
          amountCents: 900,
          dueDate: isoDateFromToday(1),
          plannedSettlementDate: isoDateFromToday(6),
          ledgerLinks: [
            createLedgerLink('recognition', 'low-2'),
            createLedgerLink('settlement', 'low-2'),
            createLedgerLink('settlement_reversal', 'low-2'),
          ],
        }),
        createPlanningEvent({
          id: 'intermediate-inflow',
          description: 'Entrada no intervalo',
          type: 'confirmado_agendado',
          status: 'confirmed',
          direction: 'inflow',
          amountCents: 500,
          dueDate: isoDateFromToday(4),
          plannedSettlementDate: isoDateFromToday(4),
        }),
      ],
    });

    const summary = await useCase.execute(CONTROL_CENTER_ID);

    expect(summary.projectedFinalBalanceCents).toBe(600);
    expect(summary.projectedInflowsCents).toBe(500);
    expect(summary.projectedOutflowsCents).toBe(900);
    expect(summary.lowestProjectedBalanceCents).toBe(600);
    expect(summary.consideredEventsCount).toBe(2);
  });
});
