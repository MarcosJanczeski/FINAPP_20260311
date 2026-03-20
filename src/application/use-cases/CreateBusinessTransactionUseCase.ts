import type { CreateBusinessTransactionInput } from '../dto/BusinessTransactionInput';
import type { BusinessTransaction } from '../../domain/entities/BusinessTransaction';
import type { LedgerAccount } from '../../domain/entities/LedgerAccount';
import type { LedgerEntry } from '../../domain/entities/LedgerEntry';
import type { LedgerAccountRepository } from '../../domain/repositories/LedgerAccountRepository';
import type { LedgerEntryRepository } from '../../domain/repositories/LedgerEntryRepository';
import type { BusinessTransactionRepository } from '../../domain/repositories/BusinessTransactionRepository';
import type { ID } from '../../domain/types/common';
import {
  validateBusinessTransactionAmounts,
  validateBusinessTransactionDates,
  validateBusinessTransactionIdentity,
  validateBusinessTransactionInstallments,
  validateBusinessTransactionSettlementContext,
} from '../../domain/services/businessTransactionDomain';
import { assertPostingLedgerLines } from '../services/ledgerPostingGuard';

export class CreateBusinessTransactionUseCase {
  constructor(
    private readonly businessTransactionRepository: BusinessTransactionRepository,
    private readonly ledgerAccountRepository: LedgerAccountRepository,
    private readonly ledgerEntryRepository: LedgerEntryRepository,
  ) {}

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
    const businessTransactionId = crypto.randomUUID();
    const created: BusinessTransaction = {
      id: businessTransactionId,
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

    const recognitionLedgerEntry = await this.buildRecognitionLedgerEntry(created);
    await assertPostingLedgerLines({
      controlCenterId,
      lines: recognitionLedgerEntry.lines,
      ledgerAccountRepository: this.ledgerAccountRepository,
    });
    await this.ledgerEntryRepository.save(recognitionLedgerEntry);

    const persisted: BusinessTransaction = {
      ...created,
      recognitionLedgerEntryId: recognitionLedgerEntry.id,
      updatedAt: new Date().toISOString(),
    };

    await this.businessTransactionRepository.save(persisted);
    return persisted;
  }

  private async buildRecognitionLedgerEntry(
    transaction: BusinessTransaction,
  ): Promise<LedgerEntry> {
    const liabilityAccount = await this.ensureSystemLedgerAccount(
      transaction.controlCenterId,
      'PASSIVO:OBRIGACOES',
      'Passivo - Obrigacoes',
      'liability',
    );
    const expenseAccount = await this.ensureSystemLedgerAccount(
      transaction.controlCenterId,
      'DESPESA:OPERACIONAL',
      'Despesa - Operacional',
      'expense',
    );
    const receivableAccount = await this.ensureSystemLedgerAccount(
      transaction.controlCenterId,
      'ATIVO:RECEBIVEIS',
      'Ativo - Recebiveis',
      'asset',
    );
    const revenueAccount = await this.ensureSystemLedgerAccount(
      transaction.controlCenterId,
      'RECEITA:OPERACIONAL',
      'Receita - Operacional',
      'revenue',
    );

    const outflowType = this.isOutflowType(transaction.type);
    const debitAccount = outflowType ? expenseAccount.id : receivableAccount.id;
    const creditAccount = outflowType ? liabilityAccount.id : revenueAccount.id;

    return {
      id: crypto.randomUUID(),
      controlCenterId: transaction.controlCenterId,
      date: transaction.documentDate,
      description: `Reconhecimento transacao - ${transaction.description}`,
      referenceType: 'business_transaction_recognition',
      referenceId: transaction.id,
      lines: [
        {
          ledgerAccountId: debitAccount,
          debitCents: transaction.amountCents,
          creditCents: 0,
        },
        {
          ledgerAccountId: creditAccount,
          debitCents: 0,
          creditCents: transaction.amountCents,
        },
      ],
      createdByUserId: transaction.createdByUserId,
      reason: 'Reconhecimento inicial de BusinessTransaction',
      createdAt: new Date().toISOString(),
    };
  }

  private isOutflowType(type: BusinessTransaction['type']): boolean {
    return (
      type === 'purchase' ||
      type === 'service_contract' ||
      type === 'financing_contract' ||
      type === 'installment_operation' ||
      type === 'other'
    );
  }

  private async ensureSystemLedgerAccount(
    controlCenterId: ID,
    code: string,
    name: string,
    kind: LedgerAccount['kind'],
  ): Promise<LedgerAccount> {
    const existing = await this.ledgerAccountRepository.getByCode(controlCenterId, code);
    if (existing) {
      return existing;
    }

    const rootCodeByKind: Record<LedgerAccount['kind'], string> = {
      asset: 'ATIVO',
      liability: 'PASSIVO',
      equity: 'PATRIMONIO_LIQUIDO',
      revenue: 'RECEITAS',
      expense: 'DESPESAS',
    };

    const parentLedgerAccountId =
      (await this.ledgerAccountRepository.getByCode(controlCenterId, rootCodeByKind[kind]))?.id ??
      null;

    const created: LedgerAccount = {
      id: crypto.randomUUID(),
      controlCenterId,
      code,
      name,
      kind,
      accountRole: 'posting',
      parentLedgerAccountId,
      isSystem: true,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    await this.ledgerAccountRepository.save(created);
    return created;
  }
}
