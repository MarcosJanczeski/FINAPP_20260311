import { describe, expect, it } from 'vitest';
import type { Commitment } from '../../../domain/entities/Commitment';
import type { StorageDriver } from '../../../infrastructure/storage/local-storage/driver';
import { LocalStorageCommitmentRepository } from '../../../infrastructure/repositories/local-storage/LocalStorageCommitmentRepository';

function createMemoryStorageDriver(): StorageDriver {
  const store = new Map<string, string>();

  return {
    getItem<T>(key: string): T | null {
      const raw = store.get(key);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as T;
    },
    setItem<T>(key: string, value: T): void {
      store.set(key, JSON.stringify(value));
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    clearNamespace(): void {
      store.clear();
    },
  };
}

function makeCommitment(overrides: Partial<Commitment> = {}): Commitment {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    controlCenterId: overrides.controlCenterId ?? 'cc-1',
    type: overrides.type ?? 'payable',
    status: overrides.status ?? 'confirmed',
    description: overrides.description ?? 'Compromisso de teste',
    amountCents: overrides.amountCents ?? 10000,
    categoryId: overrides.categoryId,
    counterpartyId: overrides.counterpartyId,
    documentDate: overrides.documentDate ?? '2026-03-10',
    dueDate: overrides.dueDate ?? '2026-03-10',
    plannedSettlementDate: overrides.plannedSettlementDate ?? '2026-03-12',
    settlementDate: overrides.settlementDate,
    expectedAccountId: overrides.expectedAccountId,
    settledAccountId: overrides.settledAccountId,
    sourceType: overrides.sourceType ?? 'manual',
    sourceId: overrides.sourceId,
    sourceEventKey: overrides.sourceEventKey ?? `manual:commitment:${crypto.randomUUID()}`,
    ledgerLinks: overrides.ledgerLinks ?? [
      {
        ledgerEntryId: `pending:recognition:${crypto.randomUUID()}`,
        relation: 'recognition',
        createdAt: '2026-03-10T10:00:00.000Z',
      },
    ],
    originalAmountCents: overrides.originalAmountCents ?? overrides.amountCents ?? 10000,
    settledAmountCents: overrides.settledAmountCents,
    settlementDifferenceCents: overrides.settlementDifferenceCents,
    settlementDifferenceReason: overrides.settlementDifferenceReason,
    createdAt: overrides.createdAt ?? '2026-03-10T10:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-03-10T10:00:00.000Z',
    createdByUserId: overrides.createdByUserId ?? 'user-1',
    notes: overrides.notes,
  };
}

describe('LocalStorageCommitmentRepository', () => {
  it('salva e busca por id', async () => {
    const repository = new LocalStorageCommitmentRepository(createMemoryStorageDriver());
    const commitment = makeCommitment();

    await repository.save(commitment);
    const found = await repository.getById(commitment.id);

    expect(found).not.toBeNull();
    expect(found?.id).toBe(commitment.id);
    expect(found?.ledgerLinks).toHaveLength(1);
  });

  it('busca por (controlCenterId, sourceEventKey)', async () => {
    const repository = new LocalStorageCommitmentRepository(createMemoryStorageDriver());
    const commitment = makeCommitment({
      controlCenterId: 'cc-lookup',
      sourceEventKey: 'manual:commitment:lookup',
    });
    await repository.save(commitment);

    const found = await repository.findBySourceEventKey('cc-lookup', 'manual:commitment:lookup');
    const notFound = await repository.findBySourceEventKey('cc-other', 'manual:commitment:lookup');

    expect(found?.id).toBe(commitment.id);
    expect(notFound).toBeNull();
  });

  it('lista por controlCenterId com filtros', async () => {
    const repository = new LocalStorageCommitmentRepository(createMemoryStorageDriver());
    await repository.save(
      makeCommitment({
        id: 'c-1',
        controlCenterId: 'cc-filter',
        type: 'payable',
        status: 'confirmed',
      }),
    );
    await repository.save(
      makeCommitment({
        id: 'c-2',
        controlCenterId: 'cc-filter',
        type: 'receivable',
        status: 'settled',
        documentDate: '2026-03-11',
        ledgerLinks: [
          {
            ledgerEntryId: 'pending:recognition:c-2',
            relation: 'recognition',
            createdAt: '2026-03-11T10:00:00.000Z',
          },
          {
            ledgerEntryId: 'pending:settlement:c-2',
            relation: 'settlement',
            createdAt: '2026-03-11T11:00:00.000Z',
          },
        ],
      }),
    );
    await repository.save(
      makeCommitment({
        id: 'c-3',
        controlCenterId: 'cc-other',
      }),
    );

    const all = await repository.listByControlCenter('cc-filter');
    const settled = await repository.listByControlCenter('cc-filter', { status: 'settled' });
    const receivable = await repository.listByControlCenter('cc-filter', { type: 'receivable' });

    expect(all).toHaveLength(2);
    expect(settled.map((item) => item.id)).toEqual(['c-2']);
    expect(receivable.map((item) => item.id)).toEqual(['c-2']);
  });

  it('bloqueia duplicidade logica entre commitments diferentes', async () => {
    const repository = new LocalStorageCommitmentRepository(createMemoryStorageDriver());
    await repository.save(
      makeCommitment({
        id: 'c-dup-1',
        controlCenterId: 'cc-dup',
        sourceEventKey: 'manual:commitment:dup',
      }),
    );

    await expect(
      repository.save(
        makeCommitment({
          id: 'c-dup-2',
          controlCenterId: 'cc-dup',
          sourceEventKey: 'manual:commitment:dup',
        }),
      ),
    ).rejects.toThrow('Ja existe commitment para este sourceEventKey no centro de controle.');
  });

  it('permite update do mesmo registro sem falso positivo de duplicidade', async () => {
    const repository = new LocalStorageCommitmentRepository(createMemoryStorageDriver());
    const created = makeCommitment({
      id: 'c-update-1',
      controlCenterId: 'cc-update',
      sourceEventKey: 'manual:commitment:update',
      description: 'Original',
    });
    await repository.save(created);

    await repository.save({
      ...created,
      description: 'Atualizado',
      notes: 'mudanca de metadado',
      updatedAt: '2026-03-11T10:00:00.000Z',
    });

    const found = await repository.getById('c-update-1');
    expect(found?.description).toBe('Atualizado');
    expect(found?.notes).toBe('mudanca de metadado');
  });
});
