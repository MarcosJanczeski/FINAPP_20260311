import { describe, expect, it } from 'vitest';
import type { CreateBusinessTransactionInput } from '../../dto/BusinessTransactionInput';
import { CreateBusinessTransactionUseCase } from '../CreateBusinessTransactionUseCase';
import type { BusinessTransaction } from '../../../domain/entities/BusinessTransaction';
import type { Commitment } from '../../../domain/entities/Commitment';
import type { CreditCardInvoice } from '../../../domain/entities/CreditCardInvoice';
import type { CreditCardInvoiceItem } from '../../../domain/entities/CreditCardInvoiceItem';
import type { LedgerAccount } from '../../../domain/entities/LedgerAccount';
import type { LedgerEntry } from '../../../domain/entities/LedgerEntry';
import type { BusinessTransactionRepository } from '../../../domain/repositories/BusinessTransactionRepository';
import type { CommitmentRepository } from '../../../domain/repositories/CommitmentRepository';
import type { CreditCardInvoiceItemRepository } from '../../../domain/repositories/CreditCardInvoiceItemRepository';
import type { CreditCardInvoiceRepository } from '../../../domain/repositories/CreditCardInvoiceRepository';
import type { LedgerAccountRepository } from '../../../domain/repositories/LedgerAccountRepository';
import type { LedgerEntryRepository } from '../../../domain/repositories/LedgerEntryRepository';

class InMemoryBusinessTransactionRepository implements BusinessTransactionRepository {
  constructor(private readonly transactions: BusinessTransaction[]) {}

  async save(transaction: BusinessTransaction): Promise<void> {
    const index = this.transactions.findIndex((current) => current.id === transaction.id);
    if (index >= 0) {
      this.transactions[index] = transaction;
      return;
    }
    this.transactions.push(transaction);
  }

  async getById(id: string): Promise<BusinessTransaction | null> {
    return this.transactions.find((transaction) => transaction.id === id) ?? null;
  }

  async listByControlCenter(controlCenterId: string): Promise<BusinessTransaction[]> {
    return this.transactions.filter((transaction) => transaction.controlCenterId === controlCenterId);
  }

  async findBySourceEventKey(
    controlCenterId: string,
    sourceEventKey: string,
  ): Promise<BusinessTransaction | null> {
    return (
      this.transactions.find(
        (transaction) =>
          transaction.controlCenterId === controlCenterId &&
          transaction.sourceEventKey === sourceEventKey,
      ) ?? null
    );
  }
}

class InMemoryLedgerAccountRepository implements LedgerAccountRepository {
  constructor(private readonly accounts: LedgerAccount[]) {}

  async getById(id: string): Promise<LedgerAccount | null> {
    return this.accounts.find((account) => account.id === id) ?? null;
  }

  async getByCode(controlCenterId: string, code: string): Promise<LedgerAccount | null> {
    return (
      this.accounts.find(
        (account) => account.controlCenterId === controlCenterId && account.code === code,
      ) ?? null
    );
  }

  async listByControlCenter(controlCenterId: string): Promise<LedgerAccount[]> {
    return this.accounts.filter((account) => account.controlCenterId === controlCenterId);
  }

  async save(account: LedgerAccount): Promise<void> {
    const index = this.accounts.findIndex((current) => current.id === account.id);
    if (index >= 0) {
      this.accounts[index] = account;
      return;
    }
    this.accounts.push(account);
  }

  async delete(id: string): Promise<void> {
    const index = this.accounts.findIndex((current) => current.id === id);
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

class InMemoryCommitmentRepository implements CommitmentRepository {
  constructor(private readonly commitments: Commitment[]) {}

  async save(commitment: Commitment): Promise<void> {
    const duplicateLogical = this.commitments.find(
      (current) =>
        current.controlCenterId === commitment.controlCenterId &&
        current.sourceEventKey === commitment.sourceEventKey &&
        current.id !== commitment.id,
    );
    if (duplicateLogical) {
      throw new Error('Ja existe commitment para este sourceEventKey no centro de controle.');
    }

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

class InMemoryCreditCardInvoiceRepository implements CreditCardInvoiceRepository {
  constructor(private readonly invoices: CreditCardInvoice[]) {}

  async save(invoice: CreditCardInvoice): Promise<void> {
    const duplicateLogical = this.invoices.find(
      (current) =>
        current.controlCenterId === invoice.controlCenterId &&
        current.sourceEventKey === invoice.sourceEventKey &&
        current.id !== invoice.id,
    );
    if (duplicateLogical) {
      throw new Error('Ja existe fatura para este sourceEventKey no centro de controle.');
    }

    const index = this.invoices.findIndex((current) => current.id === invoice.id);
    if (index >= 0) {
      this.invoices[index] = invoice;
      return;
    }
    this.invoices.push(invoice);
  }

  async getById(id: string): Promise<CreditCardInvoice | null> {
    return this.invoices.find((invoice) => invoice.id === id) ?? null;
  }

  async findByCardAndPeriod(
    controlCenterId: string,
    creditCardId: string,
    invoicePeriod: string,
  ): Promise<CreditCardInvoice | null> {
    return (
      this.invoices.find(
        (invoice) =>
          invoice.controlCenterId === controlCenterId &&
          invoice.creditCardId === creditCardId &&
          invoice.invoicePeriod === invoicePeriod,
      ) ?? null
    );
  }

  async listByCard(controlCenterId: string, creditCardId: string): Promise<CreditCardInvoice[]> {
    return this.invoices
      .filter(
        (invoice) =>
          invoice.controlCenterId === controlCenterId && invoice.creditCardId === creditCardId,
      )
      .sort((a, b) => (a.invoicePeriod > b.invoicePeriod ? 1 : -1));
  }
}

class InMemoryCreditCardInvoiceItemRepository implements CreditCardInvoiceItemRepository {
  constructor(private readonly items: CreditCardInvoiceItem[]) {}

  async save(item: CreditCardInvoiceItem): Promise<void> {
    const duplicateLogical = this.items.find(
      (current) =>
        current.controlCenterId === item.controlCenterId &&
        current.sourceEventKey === item.sourceEventKey &&
        current.id !== item.id,
    );
    if (duplicateLogical) {
      throw new Error('Ja existe item de fatura para este sourceEventKey no centro de controle.');
    }

    const index = this.items.findIndex((current) => current.id === item.id);
    if (index >= 0) {
      this.items[index] = item;
      return;
    }
    this.items.push(item);
  }

  async listByInvoice(invoiceId: string): Promise<CreditCardInvoiceItem[]> {
    return this.items.filter((item) => item.invoiceId === invoiceId);
  }

  async findBySourceEventKey(
    controlCenterId: string,
    sourceEventKey: string,
  ): Promise<CreditCardInvoiceItem | null> {
    return (
      this.items.find(
        (item) =>
          item.controlCenterId === controlCenterId && item.sourceEventKey === sourceEventKey,
      ) ?? null
    );
  }
}

function createContext() {
  const transactionRepository = new InMemoryBusinessTransactionRepository([]);
  const commitmentRepository = new InMemoryCommitmentRepository([]);
  const creditCardInvoiceRepository = new InMemoryCreditCardInvoiceRepository([]);
  const creditCardInvoiceItemRepository = new InMemoryCreditCardInvoiceItemRepository([]);
  const ledgerAccountRepository = new InMemoryLedgerAccountRepository(createRootLedgerAccounts());
  const ledgerEntryRepository = new InMemoryLedgerEntryRepository([]);
  const useCase = new CreateBusinessTransactionUseCase(
    transactionRepository,
    commitmentRepository,
    creditCardInvoiceRepository,
    creditCardInvoiceItemRepository,
    ledgerAccountRepository,
    ledgerEntryRepository,
  );

  return {
    useCase,
    transactionRepository,
    commitmentRepository,
    creditCardInvoiceRepository,
    creditCardInvoiceItemRepository,
    ledgerEntryRepository,
  };
}

function createRootLedgerAccounts(controlCenterId = 'cc-1'): LedgerAccount[] {
  const createdAt = isoDateFromToday(-30);
  return [
    {
      id: 'root-asset',
      controlCenterId,
      code: 'ATIVO',
      name: 'Ativo',
      kind: 'asset',
      accountRole: 'grouping',
      parentLedgerAccountId: null,
      isSystem: true,
      status: 'active',
      createdAt,
    },
    {
      id: 'root-liability',
      controlCenterId,
      code: 'PASSIVO',
      name: 'Passivo',
      kind: 'liability',
      accountRole: 'grouping',
      parentLedgerAccountId: null,
      isSystem: true,
      status: 'active',
      createdAt,
    },
    {
      id: 'root-equity',
      controlCenterId,
      code: 'PATRIMONIO_LIQUIDO',
      name: 'Patrimonio Liquido',
      kind: 'equity',
      accountRole: 'grouping',
      parentLedgerAccountId: null,
      isSystem: true,
      status: 'active',
      createdAt,
    },
    {
      id: 'root-revenue',
      controlCenterId,
      code: 'RECEITAS',
      name: 'Receitas',
      kind: 'revenue',
      accountRole: 'grouping',
      parentLedgerAccountId: null,
      isSystem: true,
      status: 'active',
      createdAt,
    },
    {
      id: 'root-expense',
      controlCenterId,
      code: 'DESPESAS',
      name: 'Despesas',
      kind: 'expense',
      accountRole: 'grouping',
      parentLedgerAccountId: null,
      isSystem: true,
      status: 'active',
      createdAt,
    },
    {
      id: 'acc-1',
      controlCenterId,
      code: 'ATIVO:DISPONIBILIDADES',
      name: 'Ativo - Disponibilidades',
      kind: 'asset',
      accountRole: 'posting',
      parentLedgerAccountId: 'root-asset',
      isSystem: true,
      status: 'active',
      createdAt,
    },
  ];
}

function isoDateFromToday(daysFromNow: number): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysFromNow, 12, 0, 0),
  ).toISOString();
}

function isoDateFromUtc(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).toISOString();
}

function createInput(
  overrides: Partial<CreateBusinessTransactionInput> = {},
): CreateBusinessTransactionInput {
  return {
    controlCenterId: overrides.controlCenterId ?? 'cc-1',
    sourceEventKey: overrides.sourceEventKey ?? 'manual:business-transaction:purchase:1',
    type: overrides.type ?? 'purchase',
    description: overrides.description ?? 'Compra de insumos',
    counterpartyId: overrides.counterpartyId ?? 'cp-1',
    documentDate: overrides.documentDate ?? isoDateFromToday(-1),
    dueDate: overrides.dueDate ?? isoDateFromToday(5),
    amountCents: overrides.amountCents ?? 35000,
    settlementMethod: overrides.settlementMethod ?? 'bank_account',
    expectedSettlementAccountId: overrides.expectedSettlementAccountId ?? 'acc-1',
    creditCardId: overrides.creditCardId,
    creditCardClosingDay: overrides.creditCardClosingDay,
    creditCardDueDay: overrides.creditCardDueDay,
    installmentCount: overrides.installmentCount ?? 1,
    installmentPeriodicity: overrides.installmentPeriodicity,
    notes: overrides.notes,
    createdByUserId: overrides.createdByUserId ?? 'user-1',
  };
}

describe('CreateBusinessTransactionUseCase', () => {
  it('cria transacao a vista valida com reconhecimento e liquidacao imediata consistentes', async () => {
    const { useCase, transactionRepository, ledgerEntryRepository } = createContext();

    const created = await useCase.execute(
      createInput({
        sourceEventKey: 'manual:business-transaction:cash-initial:1',
        settlementMethod: 'cash',
      }),
    );
    const saved = await transactionRepository.getById(created.id);
    const recognitionEntry = created.recognitionLedgerEntryId
      ? await ledgerEntryRepository.getById(created.recognitionLedgerEntryId)
      : null;
    const settlementEntry = created.settlementLedgerEntryId
      ? await ledgerEntryRepository.getById(created.settlementLedgerEntryId)
      : null;

    expect(saved).toBeTruthy();
    expect(created.status).toBe('confirmed');
    expect(created.commitmentIds).toEqual([]);
    expect(created.recognitionLedgerEntryId).toBeTruthy();
    expect(created.settlementLedgerEntryId).toBeTruthy();
    expect(recognitionEntry).toBeTruthy();
    expect(settlementEntry).toBeTruthy();
    expect(recognitionEntry?.referenceType).toBe('business_transaction_recognition');
    expect(recognitionEntry?.referenceId).toBe(created.id);
    expect(settlementEntry?.referenceType).toBe('business_transaction_settlement');
    expect(settlementEntry?.referenceId).toBe(created.id);
  });

  it('bloqueia duplicidade logica por (controlCenterId, sourceEventKey)', async () => {
    const { useCase, ledgerEntryRepository } = createContext();
    const input = createInput({ sourceEventKey: 'manual:business-transaction:dup:1' });

    await useCase.execute(input);
    await expect(useCase.execute(input)).rejects.toThrow(
      'Ja existe transacao para este sourceEventKey no centro de controle.',
    );
    expect((await ledgerEntryRepository.listByControlCenter('cc-1')).length).toBe(1);
  });

  it('falha sem sourceEventKey', async () => {
    const { useCase } = createContext();

    await expect(
      useCase.execute(createInput({ sourceEventKey: '   ' })),
    ).rejects.toThrow('sourceEventKey e obrigatorio para idempotencia.');
  });

  it('falha sem counterpartyId', async () => {
    const { useCase } = createContext();

    await expect(
      useCase.execute(createInput({ counterpartyId: '   ' })),
    ).rejects.toThrow('counterpartyId e obrigatorio para BusinessTransaction.');
  });

  it('falha com amountCents invalido', async () => {
    const { useCase } = createContext();

    await expect(
      useCase.execute(createInput({ amountCents: 10.2 })),
    ).rejects.toThrow('amountCents deve ser inteiro em centavos.');
  });

  it('falha com documentDate futura quando confirmado', async () => {
    const { useCase } = createContext();

    await expect(
      useCase.execute(createInput({ documentDate: isoDateFromToday(1) })),
    ).rejects.toThrow('documentDate nao pode estar no futuro para transacao confirmada.');
  });

  it('falha com dueDate anterior a documentDate', async () => {
    const { useCase } = createContext();

    await expect(
      useCase.execute(
        createInput({
          documentDate: isoDateFromToday(-1),
          dueDate: isoDateFromToday(-2),
        }),
      ),
    ).rejects.toThrow('dueDate nao pode ser anterior a documentDate.');
  });

  it('falha com parcelamento invalido', async () => {
    const { useCase } = createContext();

    await expect(
      useCase.execute(createInput({ installmentCount: 0 })),
    ).rejects.toThrow('installmentCount deve ser maior ou igual a 1.');

    await expect(
      useCase.execute(
        createInput({
          installmentCount: 3,
          installmentPeriodicity: undefined,
        }),
      ),
    ).rejects.toThrow('installmentPeriodicity e obrigatoria quando installmentCount > 1.');
  });

  it('aceita parcelamento valido quando installmentCount > 1 com periodicidade', async () => {
    const { useCase, commitmentRepository } = createContext();

    const created = await useCase.execute(
      createInput({
        sourceEventKey: 'manual:business-transaction:installment:1',
        installmentCount: 12,
        installmentPeriodicity: 'monthly',
      }),
    );

    expect(created.installmentCount).toBe(12);
    expect(created.installmentPeriodicity).toBe('monthly');
    expect(created.commitmentIds).toHaveLength(12);
    expect(created.recognitionLedgerEntryId).toBeTruthy();

    const commitments = await commitmentRepository.listByControlCenter('cc-1');
    expect(commitments).toHaveLength(12);
    expect(commitments.every((commitment) => commitment.status === 'confirmed')).toBe(true);
    expect(commitments.every((commitment) => commitment.originTransactionId === created.id)).toBe(true);
    expect(
      commitments.every(
        (commitment) => commitment.originLedgerEntryId === created.recognitionLedgerEntryId,
      ),
    ).toBe(true);
    expect(
      commitments.every((commitment) => commitment.plannedSettlementDate === commitment.dueDate),
    ).toBe(true);
    expect(new Set(commitments.map((commitment) => commitment.installmentGroupId)).size).toBe(1);
    expect(commitments.map((commitment) => commitment.installmentNumber)).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 1),
    );
    expect(commitments.reduce((sum, commitment) => sum + commitment.amountCents, 0)).toBe(35000);
    expect(commitments[11].amountCents).toBe(2924);
    expect(
      commitments.every(
        (commitment) => commitment.sourceEventKey === `${created.sourceEventKey}:commitment:${commitment.installmentNumber}`,
      ),
    ).toBe(true);
  });

  it('falha quando settlementMethod = credit_card e creditCardId ausente', async () => {
    const { useCase } = createContext();

    await expect(
      useCase.execute(
        createInput({
          settlementMethod: 'credit_card',
          creditCardId: undefined,
        }),
      ),
    ).rejects.toThrow('creditCardId e obrigatorio quando settlementMethod = credit_card.');
  });

  it('falha quando settlementMethod = credit_card sem closingDay ou dueDay', async () => {
    const { useCase } = createContext();

    await expect(
      useCase.execute(
        createInput({
          settlementMethod: 'credit_card',
          creditCardId: 'card-1',
          creditCardClosingDay: undefined,
          creditCardDueDay: 20,
        }),
      ),
    ).rejects.toThrow('creditCardClosingDay e obrigatorio quando settlementMethod = credit_card.');

    await expect(
      useCase.execute(
        createInput({
          settlementMethod: 'credit_card',
          creditCardId: 'card-1',
          creditCardClosingDay: 10,
          creditCardDueDay: undefined,
        }),
      ),
    ).rejects.toThrow('creditCardDueDay e obrigatorio quando settlementMethod = credit_card.');
  });

  it('falha quando operacao a vista nao informa conta de liquidacao esperada', async () => {
    const { useCase } = createContext();

    await expect(
      useCase.execute(
        createInput({
          sourceEventKey: 'manual:business-transaction:cash-without-account:1',
          settlementMethod: 'cash',
          expectedSettlementAccountId: '   ',
        }),
      ),
    ).rejects.toThrow('expectedSettlementAccountId e obrigatoria para liquidacao imediata.');
  });

  it('gera settlement imediato apenas para a vista e mantem a prazo/cartao sem settlement imediato', async () => {
    const { useCase, commitmentRepository, ledgerEntryRepository } = createContext();

    const cash = await useCase.execute(
      createInput({
        sourceEventKey: 'manual:business-transaction:cash:1',
        settlementMethod: 'cash',
      }),
    );
    const term = await useCase.execute(
      createInput({
        sourceEventKey: 'manual:business-transaction:term:1',
        settlementMethod: 'bank_account',
      }),
    );
    const card = await useCase.execute(
      createInput({
        sourceEventKey: 'manual:business-transaction:card:1',
        settlementMethod: 'credit_card',
        creditCardId: 'card-1',
        creditCardClosingDay: 10,
        creditCardDueDay: 20,
      }),
    );

    const entries = await ledgerEntryRepository.listByControlCenter('cc-1');
    expect(entries).toHaveLength(4);
    expect(cash.recognitionLedgerEntryId).toBeTruthy();
    expect(term.recognitionLedgerEntryId).toBeTruthy();
    expect(card.recognitionLedgerEntryId).toBeTruthy();
    expect(cash.settlementLedgerEntryId).toBeTruthy();
    expect(term.settlementLedgerEntryId).toBeUndefined();
    expect(card.settlementLedgerEntryId).toBeUndefined();

    const commitments = await commitmentRepository.listByControlCenter('cc-1');
    expect(cash.commitmentIds).toEqual([]);
    expect(card.commitmentIds).toEqual([]);
    expect(term.commitmentIds).toHaveLength(1);
    expect(commitments).toHaveLength(2);
    const termCommitment = commitments.find(
      (commitment) =>
        commitment.sourceEventKey === 'manual:business-transaction:term:1:commitment:1',
    );
    const invoiceCommitment = commitments.find(
      (commitment) => commitment.sourceType === 'credit_card_invoice',
    );
    expect(termCommitment).toBeTruthy();
    expect(invoiceCommitment).toBeTruthy();
  });

  it('cartao compra unica gera item/fatura/commitment de fatura sem commitment da compra individual', async () => {
    const { useCase, commitmentRepository, creditCardInvoiceRepository, creditCardInvoiceItemRepository } = createContext();
    const created = await useCase.execute(
      createInput({
        sourceEventKey: 'manual:business-transaction:card-single:1',
        settlementMethod: 'credit_card',
        creditCardId: 'card-1',
        creditCardClosingDay: 10,
        creditCardDueDay: 20,
        installmentCount: 1,
        installmentPeriodicity: undefined,
        amountCents: 10000,
        dueDate: isoDateFromToday(10),
      }),
    );

    expect(created.commitmentIds).toEqual([]);
    expect(created.settlementLedgerEntryId).toBeUndefined();
    expect(created.recognitionLedgerEntryId).toBeTruthy();

    const invoices = await creditCardInvoiceRepository.listByCard('cc-1', 'card-1');
    expect(invoices).toHaveLength(1);
    expect(invoices[0].calculatedAmountCents).toBe(10000);
    expect(invoices[0].finalAmountCents).toBe(10000);
    expect(invoices[0].status).toBe('draft');
    expect(invoices[0].itemIds).toHaveLength(1);
    expect(invoices[0].commitmentId).toBeTruthy();

    const items = await creditCardInvoiceItemRepository.listByInvoice(invoices[0].id);
    expect(items).toHaveLength(1);
    expect(items[0].sourceEventKey).toBe('manual:business-transaction:card-single:1:invoice-item:1');

    const commitments = await commitmentRepository.listByControlCenter('cc-1');
    expect(commitments).toHaveLength(1);
    expect(commitments[0].sourceType).toBe('credit_card_invoice');
    expect(commitments[0].sourceId).toBe(invoices[0].id);
    expect(commitments[0].dueDate).toBe(invoices[0].dueDate);
    expect(commitments[0].plannedSettlementDate).toBe(invoices[0].dueDate);
  });

  it('regra de fechamento: compra ate fechamento cai na fatura atual e apos fechamento cai na proxima', async () => {
    const { useCase, creditCardInvoiceRepository } = createContext();

    await useCase.execute(
      createInput({
        sourceEventKey: 'manual:business-transaction:card-cutoff-before:1',
        settlementMethod: 'credit_card',
        creditCardId: 'card-1',
        creditCardClosingDay: 10,
        creditCardDueDay: 20,
        installmentCount: 1,
        documentDate: isoDateFromUtc(2026, 3, 10),
      }),
    );

    await useCase.execute(
      createInput({
        sourceEventKey: 'manual:business-transaction:card-cutoff-after:1',
        settlementMethod: 'credit_card',
        creditCardId: 'card-1',
        creditCardClosingDay: 10,
        creditCardDueDay: 20,
        installmentCount: 1,
        documentDate: isoDateFromUtc(2026, 3, 11),
      }),
    );

    const invoices = await creditCardInvoiceRepository.listByCard('cc-1', 'card-1');
    expect(invoices).toHaveLength(2);
    expect(invoices[0].invoicePeriod).toBe('2026-03');
    expect(invoices[1].invoicePeriod).toBe('2026-04');
  });

  it('cartao parcelado 3x gera 3 itens e 3 faturas futuras com soma correta', async () => {
    const { useCase, creditCardInvoiceRepository, creditCardInvoiceItemRepository } = createContext();
    await useCase.execute(
      createInput({
        sourceEventKey: 'manual:business-transaction:card-3x:1',
        settlementMethod: 'credit_card',
        creditCardId: 'card-1',
        creditCardClosingDay: 10,
        creditCardDueDay: 20,
        installmentCount: 3,
        installmentPeriodicity: 'monthly',
        amountCents: 10001,
        dueDate: isoDateFromToday(10),
      }),
    );

    const invoices = await creditCardInvoiceRepository.listByCard('cc-1', 'card-1');
    expect(invoices).toHaveLength(3);
    expect(invoices.map((invoice) => invoice.calculatedAmountCents)).toEqual([3333, 3333, 3335]);
    const allItems = (
      await Promise.all(invoices.map((invoice) => creditCardInvoiceItemRepository.listByInvoice(invoice.id)))
    ).flat();
    expect(allItems).toHaveLength(3);
    expect(allItems.reduce((sum, item) => sum + item.amountCents, 0)).toBe(10001);
  });

  it('segunda compra parcelada 5x reutiliza faturas existentes e cria apenas as faltantes', async () => {
    const { useCase, creditCardInvoiceRepository, commitmentRepository } = createContext();
    const baseDueDate = isoDateFromToday(10);

    await useCase.execute(
      createInput({
        sourceEventKey: 'manual:business-transaction:card-first:1',
        settlementMethod: 'credit_card',
        creditCardId: 'card-1',
        creditCardClosingDay: 10,
        creditCardDueDay: 20,
        installmentCount: 3,
        installmentPeriodicity: 'monthly',
        amountCents: 30000,
        dueDate: baseDueDate,
      }),
    );

    await useCase.execute(
      createInput({
        sourceEventKey: 'manual:business-transaction:card-second:1',
        settlementMethod: 'credit_card',
        creditCardId: 'card-1',
        creditCardClosingDay: 10,
        creditCardDueDay: 20,
        installmentCount: 5,
        installmentPeriodicity: 'monthly',
        amountCents: 50000,
        dueDate: baseDueDate,
      }),
    );

    const invoices = await creditCardInvoiceRepository.listByCard('cc-1', 'card-1');
    expect(invoices).toHaveLength(5);
    expect(invoices.map((invoice) => invoice.calculatedAmountCents)).toEqual([
      20000, 20000, 20000, 10000, 10000,
    ]);
    expect(new Set(invoices.map((invoice) => invoice.commitmentId)).size).toBe(5);

    const commitments = await commitmentRepository.listByControlCenter('cc-1');
    expect(commitments).toHaveLength(5);
    expect(commitments.every((commitment) => commitment.sourceType === 'credit_card_invoice')).toBe(
      true,
    );
  });

  it('idempotencia de sourceEventKey evita duplicacao de item/fatura/commitment em reprocessamento', async () => {
    const {
      useCase,
      creditCardInvoiceRepository,
      commitmentRepository,
      creditCardInvoiceItemRepository,
    } = createContext();
    const input = createInput({
      sourceEventKey: 'manual:business-transaction:card-idempotent:1',
      settlementMethod: 'credit_card',
      creditCardId: 'card-1',
      creditCardClosingDay: 10,
      creditCardDueDay: 20,
      installmentCount: 2,
      installmentPeriodicity: 'monthly',
      amountCents: 10000,
      dueDate: isoDateFromToday(10),
    });

    await useCase.execute(input);
    await expect(useCase.execute(input)).rejects.toThrow(
      'Ja existe transacao para este sourceEventKey no centro de controle.',
    );

    const invoices = await creditCardInvoiceRepository.listByCard('cc-1', 'card-1');
    const invoiceItems = (
      await Promise.all(invoices.map((invoice) => creditCardInvoiceItemRepository.listByInvoice(invoice.id)))
    ).flat();
    const commitments = await commitmentRepository.listByControlCenter('cc-1');
    expect(invoiceItems).toHaveLength(2);
    expect(invoices).toHaveLength(2);
    expect(commitments).toHaveLength(2);
  });
});
