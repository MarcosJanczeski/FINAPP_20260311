import { describe, expect, it } from 'vitest';

import type { CreateCommitmentInput } from '../../dto/CommitmentInput';
import { CreateCommitmentUseCase } from '../CreateCommitmentUseCase';
import { ReverseCommitmentSettlementUseCase } from '../ReverseCommitmentSettlementUseCase';
import { SettleCommitmentUseCase } from '../SettleCommitmentUseCase';
import type { Commitment } from '../../../domain/entities/Commitment';
import type { CommitmentRepository } from '../../../domain/repositories/CommitmentRepository';
import { resolveCommitmentStatusFromLedgerLinks } from '../../../domain/services/commitmentDomain';

class InMemoryCommitmentRepository implements CommitmentRepository {
  constructor(private readonly commitments: Commitment[]) {}

  async save(commitment: Commitment): Promise<void> {
    const index = this.commitments.findIndex((current) => current.id === commitment.id);
    if (index >= 0) {
      this.commitments[index] = commitment;
      return;
    }
    this.commitments.push(commitment);
  }

  async getById(id: string): Promise<Commitment | null> {
    return this.commitments.find((commitment) => commitment.id === id) ?? null;
  }

  async listByControlCenter(controlCenterId: string): Promise<Commitment[]> {
    return this.commitments.filter((commitment) => commitment.controlCenterId === controlCenterId);
  }

  async findBySourceEventKey(
    controlCenterId: string,
    sourceEventKey: string,
  ): Promise<Commitment | null> {
    return (
      this.commitments.find(
        (commitment) =>
          commitment.controlCenterId === controlCenterId &&
          commitment.sourceEventKey === sourceEventKey,
      ) ?? null
    );
  }
}

function isoDateFromToday(daysFromNow: number): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysFromNow, 12, 0, 0),
  ).toISOString();
}

function createInput(overrides: Partial<CreateCommitmentInput> = {}): CreateCommitmentInput {
  return {
    controlCenterId: overrides.controlCenterId ?? 'cc-1',
    type: overrides.type ?? 'payable',
    description: overrides.description ?? 'Conta de energia',
    amountCents: overrides.amountCents ?? 25000,
    categoryId: overrides.categoryId,
    counterpartyId: overrides.counterpartyId,
    documentDate: overrides.documentDate ?? isoDateFromToday(-1),
    dueDate: overrides.dueDate ?? isoDateFromToday(3),
    plannedSettlementDate: overrides.plannedSettlementDate ?? isoDateFromToday(3),
    expectedAccountId: overrides.expectedAccountId ?? 'acc-expected-1',
    sourceType: overrides.sourceType ?? 'manual',
    sourceId: overrides.sourceId,
    sourceEventKey: overrides.sourceEventKey ?? 'manual:commitment:energy:1',
    createdByUserId: overrides.createdByUserId ?? 'user-1',
    notes: overrides.notes,
  };
}

describe('Commitment use cases', () => {
  it('CreateCommitmentUseCase cria commitment valido e nasce confirmed', async () => {
    const repository = new InMemoryCommitmentRepository([]);
    const createUseCase = new CreateCommitmentUseCase(repository);

    const created = await createUseCase.execute(createInput());
    const saved = await repository.getById(created.id);
    const derived = resolveCommitmentStatusFromLedgerLinks(created);

    expect(saved).toBeTruthy();
    expect(created.status).toBe('confirmed');
    expect(derived.derivedStatus).toBe('confirmed');
    expect(created.ledgerLinks).toHaveLength(1);
    expect(created.ledgerLinks[0].relation).toBe('recognition');
  });

  it('CreateCommitmentUseCase bloqueia duplicidade por (controlCenterId, sourceEventKey)', async () => {
    const repository = new InMemoryCommitmentRepository([]);
    const createUseCase = new CreateCommitmentUseCase(repository);
    const input = createInput({ sourceEventKey: 'manual:commitment:rent:1' });

    await createUseCase.execute(input);

    await expect(createUseCase.execute(input)).rejects.toThrow(
      'Ja existe commitment para este sourceEventKey no centro de controle.',
    );
  });

  it('SettleCommitmentUseCase liquida commitment confirmado e deriva settled', async () => {
    const repository = new InMemoryCommitmentRepository([]);
    const createUseCase = new CreateCommitmentUseCase(repository);
    const settleUseCase = new SettleCommitmentUseCase(repository);
    const created = await createUseCase.execute(createInput({ amountCents: 30000 }));

    const settled = await settleUseCase.execute({
      commitmentId: created.id,
      settlementDate: isoDateFromToday(0),
      settledAmountCents: 30000,
      settledAccountId: 'acc-settled-1',
    });
    const derived = resolveCommitmentStatusFromLedgerLinks(settled);

    expect(settled.status).toBe('settled');
    expect(derived.derivedStatus).toBe('settled');
    expect(settled.ledgerLinks.some((link) => link.relation === 'settlement')).toBe(true);
  });

  it('SettleCommitmentUseCase exige diferenca explicita com reason', async () => {
    const repository = new InMemoryCommitmentRepository([]);
    const createUseCase = new CreateCommitmentUseCase(repository);
    const settleUseCase = new SettleCommitmentUseCase(repository);
    const created = await createUseCase.execute(createInput({ amountCents: 50000 }));

    await expect(
      settleUseCase.execute({
        commitmentId: created.id,
        settlementDate: isoDateFromToday(1),
        settledAmountCents: 49000,
        settledAccountId: 'acc-settled-1',
      }),
    ).rejects.toThrow(
      'settlementDifferenceReason e obrigatorio quando houver diferenca de liquidacao.',
    );
  });

  it('SettleCommitmentUseCase bloqueia liquidacao em estado funcional invalido', async () => {
    const repository = new InMemoryCommitmentRepository([]);
    const createUseCase = new CreateCommitmentUseCase(repository);
    const settleUseCase = new SettleCommitmentUseCase(repository);
    const created = await createUseCase.execute(createInput({ amountCents: 18000 }));

    await settleUseCase.execute({
      commitmentId: created.id,
      settlementDate: isoDateFromToday(0),
      settledAmountCents: 18000,
      settledAccountId: 'acc-settled-1',
    });

    await expect(
      settleUseCase.execute({
        commitmentId: created.id,
        settlementDate: isoDateFromToday(1),
        settledAmountCents: 18000,
        settledAccountId: 'acc-settled-1',
      }),
    ).rejects.toThrow('Commitment nao esta elegivel para liquidacao.');
  });

  it('ReverseCommitmentSettlementUseCase estorna liquidacao ativa e volta para confirmed', async () => {
    const repository = new InMemoryCommitmentRepository([]);
    const createUseCase = new CreateCommitmentUseCase(repository);
    const settleUseCase = new SettleCommitmentUseCase(repository);
    const reverseUseCase = new ReverseCommitmentSettlementUseCase(repository);
    const created = await createUseCase.execute(createInput({ amountCents: 22000 }));

    const settled = await settleUseCase.execute({
      commitmentId: created.id,
      settlementDate: isoDateFromToday(0),
      settledAmountCents: 22000,
      settledAccountId: 'acc-settled-1',
    });
    expect(settled.status).toBe('settled');

    const reopened = await reverseUseCase.execute({
      commitmentId: created.id,
      reversalDate: isoDateFromToday(1),
      reason: 'Pagamento desfeito por erro operacional',
    });
    const derived = resolveCommitmentStatusFromLedgerLinks(reopened);

    expect(reopened.status).toBe('confirmed');
    expect(derived.derivedStatus).toBe('confirmed');
    expect(reopened.ledgerLinks.some((link) => link.relation === 'settlement_reversal')).toBe(true);
  });

  it('ReverseCommitmentSettlementUseCase bloqueia estorno sem liquidacao ativa', async () => {
    const repository = new InMemoryCommitmentRepository([]);
    const createUseCase = new CreateCommitmentUseCase(repository);
    const reverseUseCase = new ReverseCommitmentSettlementUseCase(repository);
    const created = await createUseCase.execute(createInput());

    await expect(
      reverseUseCase.execute({
        commitmentId: created.id,
        reversalDate: isoDateFromToday(1),
        reason: 'Tentativa invalida',
      }),
    ).rejects.toThrow('Commitment nao possui liquidacao ativa para estorno.');
  });

  it('use cases corrigem status persistido quando derivacao por ledgerLinks diverge', async () => {
    const repository = new InMemoryCommitmentRepository([]);
    const createUseCase = new CreateCommitmentUseCase(repository);
    const settleUseCase = new SettleCommitmentUseCase(repository);
    const created = await createUseCase.execute(createInput({ amountCents: 16000 }));

    await repository.save({
      ...created,
      status: 'settled',
      updatedAt: isoDateFromToday(0),
    });

    const settled = await settleUseCase.execute({
      commitmentId: created.id,
      settlementDate: isoDateFromToday(1),
      settledAmountCents: 16000,
      settledAccountId: 'acc-settled-1',
    });

    expect(settled.status).toBe('settled');
    expect(resolveCommitmentStatusFromLedgerLinks(settled).derivedStatus).toBe('settled');
  });
});
