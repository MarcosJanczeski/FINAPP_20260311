import type { ReverseCommitmentSettlementInput } from '../dto/CommitmentInput';
import type { Commitment } from '../../domain/entities/Commitment';
import type { CommitmentRepository } from '../../domain/repositories/CommitmentRepository';
import {
  resolveCommitmentCapabilities,
  resolveCommitmentStatusFromLedgerLinks,
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

export class ReverseCommitmentSettlementUseCase {
  constructor(private readonly commitmentRepository: CommitmentRepository) {}

  async execute(input: ReverseCommitmentSettlementInput): Promise<Commitment> {
    const commitment = await this.commitmentRepository.getById(input.commitmentId);
    if (!commitment) {
      throw new Error('Commitment nao encontrado.');
    }

    if (!input.reason.trim()) {
      throw new Error('Motivo do estorno da liquidacao e obrigatorio.');
    }
    assertIsoDate(input.reversalDate, 'reversalDate');

    const capabilities = resolveCommitmentCapabilities(commitment);
    if (!capabilities.canReverseSettlement) {
      throw new Error('Commitment nao possui liquidacao ativa para estorno.');
    }

    const updated: Commitment = {
      ...commitment,
      settlementDate: undefined,
      settledAmountCents: undefined,
      settlementDifferenceCents: undefined,
      settlementDifferenceReason: undefined,
      ledgerLinks: [
        ...commitment.ledgerLinks,
        {
          ledgerEntryId: createPendingLedgerEntryId('settlement_reversal', commitment.id),
          relation: 'settlement_reversal',
          createdAt: new Date().toISOString(),
        },
      ],
      updatedAt: new Date().toISOString(),
    };

    const statusResolution = resolveCommitmentStatusFromLedgerLinks(updated);
    if (statusResolution.derivedStatus !== 'confirmed') {
      throw new Error(
        `Estorno de liquidacao gerou estado inconsistente: ${statusResolution.inconsistencies.join(' ')}`,
      );
    }

    updated.status = statusResolution.derivedStatus;
    await this.commitmentRepository.save(updated);
    return updated;
  }
}
