import type { CreateCommitmentInput } from '../dto/CommitmentInput';
import type { Commitment } from '../../domain/entities/Commitment';
import type { CommitmentRepository } from '../../domain/repositories/CommitmentRepository';
import {
  resolveCommitmentStatusFromLedgerLinks,
  validateCommitmentAmounts,
  validateCommitmentDates,
  validateCommitmentIdentity,
} from '../../domain/services/commitmentDomain';

function createPendingLedgerEntryId(relation: string, commitmentId: string): string {
  return `pending:${relation}:${commitmentId}:${crypto.randomUUID()}`;
}

export class CreateCommitmentUseCase {
  constructor(private readonly commitmentRepository: CommitmentRepository) {}

  async execute(input: CreateCommitmentInput): Promise<Commitment> {
    const description = input.description.trim();
    if (!description) {
      throw new Error('Descricao do commitment e obrigatoria.');
    }

    const counterpartyId = input.counterpartyId.trim();
    validateCommitmentIdentity({
      sourceEventKey: input.sourceEventKey,
      counterpartyId,
    });

    const existing = await this.commitmentRepository.findBySourceEventKey(
      input.controlCenterId,
      input.sourceEventKey,
    );
    if (existing) {
      throw new Error('Ja existe commitment para este sourceEventKey no centro de controle.');
    }

    const now = new Date().toISOString();
    const commitmentId = crypto.randomUUID();
    const created: Commitment = {
      id: commitmentId,
      controlCenterId: input.controlCenterId,
      type: input.type,
      status: 'confirmed',
      description,
      amountCents: input.amountCents,
      categoryId: input.categoryId,
      counterpartyId,
      documentDate: input.documentDate,
      dueDate: input.dueDate,
      plannedSettlementDate: input.plannedSettlementDate,
      expectedAccountId: input.expectedAccountId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceEventKey: input.sourceEventKey,
      ledgerLinks: [
        {
          ledgerEntryId: createPendingLedgerEntryId('recognition', commitmentId),
          relation: 'recognition',
          createdAt: now,
        },
      ],
      originalAmountCents: input.amountCents,
      createdAt: now,
      updatedAt: now,
      createdByUserId: input.createdByUserId,
      notes: input.notes?.trim() || undefined,
    };

    validateCommitmentDates(created);
    validateCommitmentAmounts(created);

    const statusResolution = resolveCommitmentStatusFromLedgerLinks(created);
    if (statusResolution.derivedStatus !== 'confirmed') {
      throw new Error(
        `Commitment criado em estado invalido: ${statusResolution.inconsistencies.join(' ')}`,
      );
    }

    created.status = statusResolution.derivedStatus;
    await this.commitmentRepository.save(created);
    return created;
  }
}
