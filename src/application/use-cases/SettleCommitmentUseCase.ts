import type { SettleCommitmentInput } from '../dto/CommitmentInput';
import type { Commitment } from '../../domain/entities/Commitment';
import type { CommitmentRepository } from '../../domain/repositories/CommitmentRepository';
import {
  resolveCommitmentCapabilities,
  resolveCommitmentStatusFromLedgerLinks,
  validateCommitmentAmounts,
} from '../../domain/services/commitmentDomain';

function createPendingLedgerEntryId(relation: string, commitmentId: string): string {
  return `pending:${relation}:${commitmentId}:${crypto.randomUUID()}`;
}

function assertIsoDate(value: string, field: string): void {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${field} invalida.`);
  }
}

export class SettleCommitmentUseCase {
  constructor(private readonly commitmentRepository: CommitmentRepository) {}

  async execute(input: SettleCommitmentInput): Promise<Commitment> {
    const commitment = await this.commitmentRepository.getById(input.commitmentId);
    if (!commitment) {
      throw new Error('Commitment nao encontrado.');
    }

    assertIsoDate(input.settlementDate, 'settlementDate');

    const capabilities = resolveCommitmentCapabilities(commitment);
    if (!capabilities.canSettle) {
      throw new Error('Commitment nao esta elegivel para liquidacao.');
    }

    const settlementDifferenceCents = input.settledAmountCents - commitment.originalAmountCents;
    const updated: Commitment = {
      ...commitment,
      settlementDate: input.settlementDate,
      settledAccountId: input.settledAccountId,
      settledAmountCents: input.settledAmountCents,
      settlementDifferenceCents:
        settlementDifferenceCents === 0 ? undefined : settlementDifferenceCents,
      settlementDifferenceReason:
        settlementDifferenceCents === 0
          ? undefined
          : input.settlementDifferenceReason?.trim() || undefined,
      ledgerLinks: [
        ...commitment.ledgerLinks,
        {
          ledgerEntryId: createPendingLedgerEntryId('settlement', commitment.id),
          relation: 'settlement',
          createdAt: new Date().toISOString(),
        },
      ],
      updatedAt: new Date().toISOString(),
    };

    validateCommitmentAmounts(updated);

    const statusResolution = resolveCommitmentStatusFromLedgerLinks(updated);
    if (statusResolution.derivedStatus !== 'settled') {
      throw new Error(
        `Liquidacao gerou estado inconsistente: ${statusResolution.inconsistencies.join(' ')}`,
      );
    }

    updated.status = statusResolution.derivedStatus;
    await this.commitmentRepository.save(updated);
    return updated;
  }
}
