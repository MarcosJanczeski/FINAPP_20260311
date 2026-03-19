import { describe, expect, it } from 'vitest';

import type { Commitment } from '../../../domain/entities/Commitment';
import type { CommitmentRepository } from '../../../domain/repositories/CommitmentRepository';
import {
  resolveCommitmentCapabilities,
  resolveCommitmentStatusFromLedgerLinks,
  validateCommitmentAmounts,
  validateCommitmentDates,
  validateCommitmentIdentity,
} from '../../../domain/services/commitmentDomain';

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

function buildCommitment(overrides: Partial<Commitment> = {}): Commitment {
  return {
    id: overrides.id ?? 'commitment-1',
    controlCenterId: overrides.controlCenterId ?? 'cc-1',
    type: overrides.type ?? 'payable',
    status: overrides.status ?? 'confirmed',
    description: overrides.description ?? 'Conta a pagar',
    amountCents: overrides.amountCents ?? 10000,
    categoryId: overrides.categoryId,
    counterpartyId: overrides.counterpartyId,
    documentDate: overrides.documentDate ?? isoDateFromToday(-1),
    dueDate: overrides.dueDate ?? isoDateFromToday(3),
    plannedSettlementDate: overrides.plannedSettlementDate ?? isoDateFromToday(3),
    settlementDate: overrides.settlementDate,
    expectedAccountId: overrides.expectedAccountId,
    settledAccountId: overrides.settledAccountId,
    sourceType: overrides.sourceType ?? 'manual',
    sourceId: overrides.sourceId,
    sourceEventKey: overrides.sourceEventKey ?? 'manual:commitment:1',
    ledgerLinks:
      overrides.ledgerLinks ?? [
        {
          ledgerEntryId: 'le-recognition-1',
          relation: 'recognition',
          createdAt: isoDateFromToday(-1),
        },
      ],
    originalAmountCents: overrides.originalAmountCents ?? 10000,
    settledAmountCents: overrides.settledAmountCents,
    settlementDifferenceCents: overrides.settlementDifferenceCents,
    settlementDifferenceReason: overrides.settlementDifferenceReason,
    createdAt: overrides.createdAt ?? isoDateFromToday(-1),
    updatedAt: overrides.updatedAt ?? isoDateFromToday(-1),
    createdByUserId: overrides.createdByUserId ?? 'user-1',
    notes: overrides.notes,
  };
}

describe('Commitment domain rules', () => {
  it('commitment valido nasce confirmado', () => {
    const commitment = buildCommitment({ status: 'confirmed' });

    validateCommitmentIdentity(commitment);
    validateCommitmentDates(commitment);
    validateCommitmentAmounts(commitment);

    const status = resolveCommitmentStatusFromLedgerLinks(commitment);
    expect(status.derivedStatus).toBe('confirmed');
  });

  it('falha quando documentDate esta no futuro', () => {
    const commitment = buildCommitment({ documentDate: isoDateFromToday(1) });

    expect(() => validateCommitmentDates(commitment)).toThrow(
      'documentDate nao pode estar no futuro.',
    );
  });

  it('falha quando dueDate e anterior a documentDate', () => {
    const commitment = buildCommitment({
      documentDate: isoDateFromToday(-1),
      dueDate: isoDateFromToday(-2),
    });

    expect(() => validateCommitmentDates(commitment)).toThrow(
      'dueDate nao pode ser anterior a documentDate.',
    );
  });

  it('deriva settled quando reconhecimento e liquidacao estao ativos', () => {
    const commitment = buildCommitment({
      ledgerLinks: [
        { ledgerEntryId: 'le-r-1', relation: 'recognition', createdAt: isoDateFromToday(-1) },
        { ledgerEntryId: 'le-s-1', relation: 'settlement', createdAt: isoDateFromToday(0) },
      ],
    });

    const status = resolveCommitmentStatusFromLedgerLinks(commitment);
    const capabilities = resolveCommitmentCapabilities(commitment);

    expect(status.derivedStatus).toBe('settled');
    expect(capabilities.isSettled).toBe(true);
    expect(capabilities.canReverseSettlement).toBe(true);
  });

  it('deriva confirmed quando settlement foi revertido', () => {
    const commitment = buildCommitment({
      ledgerLinks: [
        { ledgerEntryId: 'le-r-1', relation: 'recognition', createdAt: isoDateFromToday(-1) },
        { ledgerEntryId: 'le-s-1', relation: 'settlement', createdAt: isoDateFromToday(0) },
        {
          ledgerEntryId: 'le-sr-1',
          relation: 'settlement_reversal',
          createdAt: isoDateFromToday(1),
        },
      ],
    });

    const status = resolveCommitmentStatusFromLedgerLinks(commitment);
    expect(status.derivedStatus).toBe('confirmed');
    expect(status.hasActiveSettlement).toBe(false);
  });

  it('sinaliza inconsistencia quando reconhecimento foi revertido para commitment aberto', () => {
    const commitment = buildCommitment({
      ledgerLinks: [
        { ledgerEntryId: 'le-r-1', relation: 'recognition', createdAt: isoDateFromToday(-1) },
        {
          ledgerEntryId: 'le-rr-1',
          relation: 'recognition_reversal',
          createdAt: isoDateFromToday(0),
        },
      ],
    });

    const status = resolveCommitmentStatusFromLedgerLinks(commitment);
    expect(status.derivedStatus).toBe('invalid');
    expect(status.inconsistencies).toContain('Commitment aberto sem reconhecimento ativo.');
  });

  it('exige reason quando ha diferenca explicita de liquidacao', () => {
    const commitment = buildCommitment({
      settledAmountCents: 10500,
      settlementDifferenceCents: 500,
      settlementDifferenceReason: undefined,
    });

    expect(() => validateCommitmentAmounts(commitment)).toThrow(
      'settlementDifferenceReason e obrigatorio quando houver diferenca de liquidacao.',
    );
  });

  it('nao aceita settlementDifferenceCents sem diferenca real', () => {
    const commitment = buildCommitment({
      settledAmountCents: 10000,
      settlementDifferenceCents: 500,
      settlementDifferenceReason: 'Ajuste indevido',
    });

    expect(() => validateCommitmentAmounts(commitment)).toThrow(
      'settlementDifferenceCents nao deve existir sem diferenca explicita.',
    );
  });

  it('sourceEventKey e obrigatorio para idempotencia logica', () => {
    const commitment = buildCommitment({ sourceEventKey: '   ' });

    expect(() => validateCommitmentIdentity(commitment)).toThrow(
      'sourceEventKey e obrigatorio para idempotencia.',
    );
  });

  it('lookup por controlCenterId + sourceEventKey isola unicidade logica', async () => {
    const repo = new InMemoryCommitmentRepository([
      buildCommitment({
        id: 'c-1',
        controlCenterId: 'cc-1',
        sourceEventKey: 'manual:commitment:shared-key',
      }),
      buildCommitment({
        id: 'c-2',
        controlCenterId: 'cc-2',
        sourceEventKey: 'manual:commitment:shared-key',
      }),
    ]);

    const inCenterOne = await repo.findBySourceEventKey('cc-1', 'manual:commitment:shared-key');
    const inCenterTwo = await repo.findBySourceEventKey('cc-2', 'manual:commitment:shared-key');

    expect(inCenterOne?.id).toBe('c-1');
    expect(inCenterTwo?.id).toBe('c-2');
  });
});
