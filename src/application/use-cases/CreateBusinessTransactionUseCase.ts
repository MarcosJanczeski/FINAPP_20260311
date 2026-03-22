import type { CreateBusinessTransactionInput } from '../dto/BusinessTransactionInput';
import type { BusinessTransaction } from '../../domain/entities/BusinessTransaction';
import type { Commitment } from '../../domain/entities/Commitment';
import type { CreditCardInvoice } from '../../domain/entities/CreditCardInvoice';
import type { CreditCardInvoiceItem } from '../../domain/entities/CreditCardInvoiceItem';
import type { LedgerAccount } from '../../domain/entities/LedgerAccount';
import type { LedgerEntry } from '../../domain/entities/LedgerEntry';
import type { CommitmentRepository } from '../../domain/repositories/CommitmentRepository';
import type { CreditCardInvoiceItemRepository } from '../../domain/repositories/CreditCardInvoiceItemRepository';
import type { CreditCardInvoiceRepository } from '../../domain/repositories/CreditCardInvoiceRepository';
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
import { resolveCreditCardInvoiceCycle } from '../../domain/services/creditCardInvoiceDomain';
import { assertPostingLedgerLines } from '../services/ledgerPostingGuard';

export class CreateBusinessTransactionUseCase {
  constructor(
    private readonly businessTransactionRepository: BusinessTransactionRepository,
    private readonly commitmentRepository: CommitmentRepository,
    private readonly creditCardInvoiceRepository: CreditCardInvoiceRepository,
    private readonly creditCardInvoiceItemRepository: CreditCardInvoiceItemRepository,
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
    const creditCardClosingDay = input.creditCardClosingDay;
    const creditCardDueDay = input.creditCardDueDay;
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
      creditCardClosingDay,
      creditCardDueDay,
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

    const settlementLedgerEntry = await this.buildImmediateSettlementLedgerEntry({
      transaction: created,
      recognitionLedgerEntry,
    });
    if (settlementLedgerEntry) {
      await assertPostingLedgerLines({
        controlCenterId: controlCenterId,
        lines: settlementLedgerEntry.lines,
        ledgerAccountRepository: this.ledgerAccountRepository,
      });
      await this.ledgerEntryRepository.save(settlementLedgerEntry);
    }

    const commitmentIds = await this.createDerivedCommitments({
      transaction: created,
      recognitionLedgerEntryId: recognitionLedgerEntry.id,
    });

    const persisted: BusinessTransaction = {
      ...created,
      recognitionLedgerEntryId: recognitionLedgerEntry.id,
      settlementLedgerEntryId: settlementLedgerEntry?.id,
      commitmentIds,
      updatedAt: new Date().toISOString(),
    };

    await this.businessTransactionRepository.save(persisted);
    return persisted;
  }

  private async createDerivedCommitments(input: {
    transaction: BusinessTransaction;
    recognitionLedgerEntryId: ID;
  }): Promise<ID[]> {
    const { transaction, recognitionLedgerEntryId } = input;

    // Cartao compoe fatura futura; nao gera commitment aberto por compra individual.
    if (transaction.settlementMethod === 'credit_card') {
      await this.createOrUpdateCreditCardInvoices({
        transaction,
        recognitionLedgerEntryId,
      });
      return [];
    }

    // Operacao a vista (caixa) nao gera commitment aberto.
    if (transaction.settlementMethod === 'cash') {
      return [];
    }

    const dueDate = transaction.dueDate;
    if (!dueDate) {
      return [];
    }

    const installmentCount = transaction.installmentCount;
    if (installmentCount <= 0) {
      return [];
    }

    const installmentDates = this.buildInstallmentDates({
      firstDueDate: dueDate,
      installmentCount,
      installmentPeriodicity: transaction.installmentPeriodicity,
    });
    const installmentAmounts = this.buildInstallmentAmounts({
      totalAmountCents: transaction.amountCents,
      installmentCount,
    });

    const commitmentIds: ID[] = [];
    const installmentGroupId = crypto.randomUUID();
    const now = new Date().toISOString();

    for (let index = 0; index < installmentCount; index += 1) {
      const installmentNumber = index + 1;
      const sourceEventKey = this.buildCommitmentSourceEventKey(transaction.sourceEventKey, installmentNumber);

      const existing = await this.commitmentRepository.findBySourceEventKey(
        transaction.controlCenterId,
        sourceEventKey,
      );
      if (existing) {
        throw new Error('Ja existe commitment derivado para este sourceEventKey de parcela.');
      }

      const amountCents = installmentAmounts[index];
      const dueDateByInstallment = installmentDates[index];
      const commitment: Commitment = {
        id: crypto.randomUUID(),
        controlCenterId: transaction.controlCenterId,
        type: this.resolveCommitmentType(transaction.type),
        status: 'confirmed',
        description:
          installmentCount > 1
            ? `${transaction.description} (parcela ${installmentNumber}/${installmentCount})`
            : transaction.description,
        amountCents,
        counterpartyId: transaction.counterpartyId,
        documentDate: transaction.documentDate,
        dueDate: dueDateByInstallment,
        plannedSettlementDate: dueDateByInstallment,
        settlementDate: undefined,
        expectedAccountId: transaction.expectedSettlementAccountId,
        settledAccountId: undefined,
        sourceType: 'business_transaction',
        sourceId: transaction.id,
        sourceEventKey,
        originTransactionId: transaction.id,
        originLedgerEntryId: recognitionLedgerEntryId,
        installmentGroupId,
        installmentNumber,
        installmentCount,
        installmentPeriodicity:
          transaction.installmentPeriodicity ??
          (installmentCount > 1 ? 'monthly' : undefined),
        ledgerLinks: [
          {
            ledgerEntryId: recognitionLedgerEntryId,
            relation: 'recognition',
            createdAt: now,
          },
        ],
        originalAmountCents: amountCents,
        settledAmountCents: undefined,
        settlementDifferenceCents: undefined,
        settlementDifferenceReason: undefined,
        createdAt: now,
        updatedAt: now,
        createdByUserId: transaction.createdByUserId,
        notes: transaction.notes,
      };

      await this.commitmentRepository.save(commitment);
      commitmentIds.push(commitment.id);
    }

    return commitmentIds;
  }

  private async createOrUpdateCreditCardInvoices(input: {
    transaction: BusinessTransaction;
    recognitionLedgerEntryId: ID;
  }): Promise<void> {
    const { transaction, recognitionLedgerEntryId } = input;
    if (!transaction.creditCardId) {
      throw new Error('creditCardId e obrigatorio para transacao de cartao.');
    }

    const firstDueDate = transaction.documentDate;
    const installmentDates = this.buildInstallmentDates({
      firstDueDate,
      installmentCount: transaction.installmentCount,
      installmentPeriodicity: transaction.installmentPeriodicity,
    });
    const installmentAmounts = this.buildInstallmentAmounts({
      totalAmountCents: transaction.amountCents,
      installmentCount: transaction.installmentCount,
    });

    for (let index = 0; index < transaction.installmentCount; index += 1) {
      const installmentNumber = index + 1;
      const installmentCompetenceDate = installmentDates[index];
      const invoiceCycle = resolveCreditCardInvoiceCycle({
        competenceDate: installmentCompetenceDate,
        closingDay: transaction.creditCardClosingDay ?? 0,
        dueDay: transaction.creditCardDueDay ?? 0,
      });
      const itemSourceEventKey = this.buildCreditCardInvoiceItemSourceEventKey(
        transaction.sourceEventKey,
        installmentNumber,
      );

      const existingItem = await this.creditCardInvoiceItemRepository.findBySourceEventKey(
        transaction.controlCenterId,
        itemSourceEventKey,
      );
      if (existingItem) {
        continue;
      }

      const invoice = await this.getOrCreateInvoice({
        transaction,
        invoiceCycle,
      });

      const now = new Date().toISOString();
      const item: CreditCardInvoiceItem = {
        id: crypto.randomUUID(),
        controlCenterId: transaction.controlCenterId,
        creditCardId: transaction.creditCardId,
        businessTransactionId: transaction.id,
        sourceEventKey: itemSourceEventKey,
        installmentNumber,
        installmentCount: transaction.installmentCount,
        amountCents: installmentAmounts[index],
        documentDate: installmentCompetenceDate,
        invoiceId: invoice.id,
        createdAt: now,
        updatedAt: now,
      };

      await this.creditCardInvoiceItemRepository.save(item);

      const nextItemIds = invoice.itemIds.includes(item.id)
        ? invoice.itemIds
        : [...invoice.itemIds, item.id];
      const nextCalculatedAmountCents = invoice.calculatedAmountCents + item.amountCents;

      const commitment = await this.createOrUpdateInvoiceCommitment({
        transaction,
        invoice,
        amountCents: nextCalculatedAmountCents,
        recognitionLedgerEntryId,
      });

      await this.creditCardInvoiceRepository.save({
        ...invoice,
        calculatedAmountCents: nextCalculatedAmountCents,
        finalAmountCents: nextCalculatedAmountCents,
        itemIds: nextItemIds,
        commitmentId: commitment.id,
        updatedAt: now,
      });
    }
  }

  private async getOrCreateInvoice(input: {
    transaction: BusinessTransaction;
    invoiceCycle: {
      invoicePeriod: string;
      closingDate: string;
      dueDate: string;
    };
  }): Promise<CreditCardInvoice> {
    const { transaction, invoiceCycle } = input;
    const existing = await this.creditCardInvoiceRepository.findByCardAndPeriod(
      transaction.controlCenterId,
      transaction.creditCardId!,
      invoiceCycle.invoicePeriod,
    );
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      controlCenterId: transaction.controlCenterId,
      creditCardId: transaction.creditCardId!,
      sourceEventKey: this.buildInvoiceSourceEventKey(
        transaction.controlCenterId,
        transaction.creditCardId!,
        invoiceCycle.invoicePeriod,
      ),
      invoicePeriod: invoiceCycle.invoicePeriod,
      closingDate: invoiceCycle.closingDate,
      dueDate: invoiceCycle.dueDate,
      calculatedAmountCents: 0,
      finalAmountCents: 0,
      itemIds: [],
      commitmentId: undefined,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
  }

  private async createOrUpdateInvoiceCommitment(input: {
    transaction: BusinessTransaction;
    invoice: CreditCardInvoice;
    amountCents: number;
    recognitionLedgerEntryId: ID;
  }): Promise<Commitment> {
    const { transaction, invoice, amountCents, recognitionLedgerEntryId } = input;
    const now = new Date().toISOString();
    const sourceEventKey = `${invoice.sourceEventKey}:commitment`;
    const existingBySourceEventKey = await this.commitmentRepository.findBySourceEventKey(
      transaction.controlCenterId,
      sourceEventKey,
    );

    if (existingBySourceEventKey) {
      const recognitionLinkAlreadyExists = existingBySourceEventKey.ledgerLinks.some(
        (link) =>
          link.relation === 'recognition' && link.ledgerEntryId === recognitionLedgerEntryId,
      );
      const nextLedgerLinks = recognitionLinkAlreadyExists
        ? existingBySourceEventKey.ledgerLinks
        : [
            ...existingBySourceEventKey.ledgerLinks,
            {
              ledgerEntryId: recognitionLedgerEntryId,
              relation: 'recognition' as const,
              createdAt: now,
            },
          ];

      const updated: Commitment = {
        ...existingBySourceEventKey,
        description: `Fatura cartao ${invoice.creditCardId} - ${invoice.invoicePeriod}`,
        amountCents,
        originalAmountCents: amountCents,
        documentDate: transaction.documentDate,
        dueDate: invoice.dueDate,
        plannedSettlementDate: invoice.dueDate,
        sourceType: 'credit_card_invoice',
        sourceId: invoice.id,
        counterpartyId: this.resolveInvoiceCounterpartyId(invoice.creditCardId),
        originTransactionId: undefined,
        originLedgerEntryId: undefined,
        settlementDate: undefined,
        settledAmountCents: undefined,
        settlementDifferenceCents: undefined,
        settlementDifferenceReason: undefined,
        ledgerLinks: nextLedgerLinks,
        status: 'confirmed',
        updatedAt: now,
      };
      await this.commitmentRepository.save(updated);
      return updated;
    }

    const created: Commitment = {
      id: invoice.commitmentId ?? crypto.randomUUID(),
      controlCenterId: transaction.controlCenterId,
      type: 'payable',
      status: 'confirmed',
      description: `Fatura cartao ${invoice.creditCardId} - ${invoice.invoicePeriod}`,
      amountCents,
      counterpartyId: this.resolveInvoiceCounterpartyId(invoice.creditCardId),
      documentDate: transaction.documentDate,
      dueDate: invoice.dueDate,
      plannedSettlementDate: invoice.dueDate,
      settlementDate: undefined,
      expectedAccountId: transaction.expectedSettlementAccountId,
      settledAccountId: undefined,
      sourceType: 'credit_card_invoice',
      sourceId: invoice.id,
      sourceEventKey,
      originTransactionId: undefined,
      originLedgerEntryId: undefined,
      installmentGroupId: undefined,
      installmentNumber: undefined,
      installmentCount: undefined,
      installmentPeriodicity: undefined,
      ledgerLinks: [
        {
          ledgerEntryId: recognitionLedgerEntryId,
          relation: 'recognition',
          createdAt: now,
        },
      ],
      originalAmountCents: amountCents,
      settledAmountCents: undefined,
      settlementDifferenceCents: undefined,
      settlementDifferenceReason: undefined,
      createdAt: now,
      updatedAt: now,
      createdByUserId: transaction.createdByUserId,
      notes: `Compromisso aberto consolidado da fatura ${invoice.invoicePeriod}.`,
    };

    await this.commitmentRepository.save(created);
    return created;
  }

  private resolveCommitmentType(type: BusinessTransaction['type']): Commitment['type'] {
    if (type === 'sale') {
      return 'receivable';
    }
    return 'payable';
  }

  private buildCommitmentSourceEventKey(transactionSourceEventKey: string, installmentNumber: number): string {
    return `${transactionSourceEventKey}:commitment:${installmentNumber}`;
  }

  private buildCreditCardInvoiceItemSourceEventKey(
    transactionSourceEventKey: string,
    installmentNumber: number,
  ): string {
    return `${transactionSourceEventKey}:invoice-item:${installmentNumber}`;
  }

  private buildInvoiceSourceEventKey(
    controlCenterId: string,
    creditCardId: string,
    invoicePeriod: string,
  ): string {
    return `invoice:${controlCenterId}:${creditCardId}:${invoicePeriod}`;
  }

  private resolveInvoiceCounterpartyId(creditCardId: string): ID {
    return `credit-card-issuer:${creditCardId}`;
  }

  private buildInstallmentAmounts(input: {
    totalAmountCents: number;
    installmentCount: number;
  }): number[] {
    const baseAmount = Math.floor(input.totalAmountCents / input.installmentCount);
    const remainder = input.totalAmountCents - baseAmount * input.installmentCount;

    return Array.from({ length: input.installmentCount }, (_, index) =>
      index === input.installmentCount - 1 ? baseAmount + remainder : baseAmount,
    );
  }

  private buildInstallmentDates(input: {
    firstDueDate: string;
    installmentCount: number;
    installmentPeriodicity: BusinessTransaction['installmentPeriodicity'];
  }): string[] {
    if (input.installmentCount === 1) {
      return [input.firstDueDate];
    }

    const periodicity = input.installmentPeriodicity ?? 'monthly';
    const first = new Date(input.firstDueDate);
    if (Number.isNaN(first.getTime())) {
      throw new Error('dueDate invalida para gerar parcelas.');
    }

    return Array.from({ length: input.installmentCount }, (_, index) => {
      const date = new Date(first);

      switch (periodicity) {
        case 'weekly':
          date.setUTCDate(date.getUTCDate() + index * 7);
          break;
        case 'biweekly':
          date.setUTCDate(date.getUTCDate() + index * 14);
          break;
        case 'yearly':
          date.setUTCFullYear(date.getUTCFullYear() + index);
          break;
        case 'other':
        case 'monthly':
        default:
          date.setUTCMonth(date.getUTCMonth() + index);
          break;
      }

      return date.toISOString();
    });
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

  private async buildImmediateSettlementLedgerEntry(input: {
    transaction: BusinessTransaction;
    recognitionLedgerEntry: LedgerEntry;
  }): Promise<LedgerEntry | null> {
    const { transaction } = input;

    if (transaction.settlementMethod !== 'cash') {
      return null;
    }

    if (!transaction.expectedSettlementAccountId) {
      throw new Error('expectedSettlementAccountId e obrigatoria para liquidacao imediata.');
    }

    const liabilityAccount = await this.ensureSystemLedgerAccount(
      transaction.controlCenterId,
      'PASSIVO:OBRIGACOES',
      'Passivo - Obrigacoes',
      'liability',
    );
    const receivableAccount = await this.ensureSystemLedgerAccount(
      transaction.controlCenterId,
      'ATIVO:RECEBIVEIS',
      'Ativo - Recebiveis',
      'asset',
    );

    const outflowType = this.isOutflowType(transaction.type);
    const debitAccount = outflowType
      ? liabilityAccount.id
      : transaction.expectedSettlementAccountId;
    const creditAccount = outflowType
      ? transaction.expectedSettlementAccountId
      : receivableAccount.id;

    return {
      id: crypto.randomUUID(),
      controlCenterId: transaction.controlCenterId,
      date: transaction.documentDate,
      description: `Liquidacao imediata transacao - ${transaction.description}`,
      referenceType: 'business_transaction_settlement',
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
      reason: 'Liquidacao imediata de BusinessTransaction a vista',
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
