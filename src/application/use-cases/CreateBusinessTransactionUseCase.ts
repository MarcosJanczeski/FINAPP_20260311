import type { CreateBusinessTransactionInput } from '../dto/BusinessTransactionInput';
import type { BusinessTransaction } from '../../domain/entities/BusinessTransaction';
import type { BusinessTransactionRepository } from '../../domain/repositories/BusinessTransactionRepository';
import {
  validateBusinessTransactionAmounts,
  validateBusinessTransactionDates,
  validateBusinessTransactionIdentity,
  validateBusinessTransactionInstallments,
  validateBusinessTransactionSettlementContext,
} from '../../domain/services/businessTransactionDomain';

export class CreateBusinessTransactionUseCase {
  constructor(private readonly businessTransactionRepository: BusinessTransactionRepository) {}

  async execute(input: CreateBusinessTransactionInput): Promise<BusinessTransaction> {
    const controlCenterId = input.controlCenterId.trim();
    const sourceEventKey = input.sourceEventKey.trim();
    const counterpartyId = input.counterpartyId.trim();
    const description = input.description.trim();
    const expectedSettlementAccountId = input.expectedSettlementAccountId?.trim() || undefined;
    const creditCardId = input.creditCardId?.trim() || undefined;
    const notes = input.notes?.trim() || undefined;

    if (!description) {
      throw new Error('description e obrigatoria.');
    }

    validateBusinessTransactionIdentity({
      controlCenterId,
      sourceEventKey,
      counterpartyId,
    });

    const existing = await this.businessTransactionRepository.findBySourceEventKey(
      controlCenterId,
      sourceEventKey,
    );
    if (existing) {
      throw new Error('Ja existe transacao para este sourceEventKey no centro de controle.');
    }

    const now = new Date().toISOString();
    const created: BusinessTransaction = {
      id: crypto.randomUUID(),
      controlCenterId,
      sourceEventKey,
      type: input.type,
      description,
      counterpartyId,
      documentDate: input.documentDate,
      dueDate: input.dueDate,
      amountCents: input.amountCents,
      settlementMethod: input.settlementMethod,
      expectedSettlementAccountId,
      creditCardId,
      installmentCount: input.installmentCount,
      installmentPeriodicity: input.installmentPeriodicity,
      recognitionLedgerEntryId: undefined,
      settlementLedgerEntryId: undefined,
      commitmentIds: [],
      status: 'confirmed',
      createdAt: now,
      updatedAt: now,
      createdByUserId: input.createdByUserId,
      notes,
    };

    validateBusinessTransactionAmounts(created);
    validateBusinessTransactionDates(created);
    validateBusinessTransactionInstallments(created);
    validateBusinessTransactionSettlementContext(created);

    await this.businessTransactionRepository.save(created);
    return created;
  }
}
