import { describe, expect, it } from 'vitest';
import type { CreateBusinessTransactionInput } from '../../dto/BusinessTransactionInput';
import { CreateBusinessTransactionUseCase } from '../CreateBusinessTransactionUseCase';
import type { BusinessTransaction } from '../../../domain/entities/BusinessTransaction';
import type { Commitment } from '../../../domain/entities/Commitment';
import type { LedgerAccount } from '../../../domain/entities/LedgerAccount';
import type { LedgerEntry } from '../../../domain/entities/LedgerEntry';
import type { BusinessTransactionRepository } from '../../../domain/repositories/BusinessTransactionRepository';
import type { CommitmentRepository } from '../../../domain/repositories/CommitmentRepository';
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
  ];
}

function isoDateFromToday(daysFromNow: number): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysFromNow, 12, 0, 0),
  ).toISOString();
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
    installmentCount: overrides.installmentCount ?? 1,
    installmentPeriodicity: overrides.installmentPeriodicity,
    notes: overrides.notes,
    createdByUserId: overrides.createdByUserId ?? 'user-1',
  };
}

describe('CreateBusinessTransactionUseCase', () => {
  it('cria transacao valida, persiste e nasce confirmed com campos iniciais consistentes', async () => {
    const repository = new InMemoryBusinessTransactionRepository([]);
    const commitmentRepository = new InMemoryCommitmentRepository([]);
    const ledgerAccountRepository = new InMemoryLedgerAccountRepository(createRootLedgerAccounts());
    const ledgerEntryRepository = new InMemoryLedgerEntryRepository([]);
    const useCase = new CreateBusinessTransactionUseCase(
      repository,
      commitmentRepository,
      ledgerAccountRepository,
      ledgerEntryRepository,
    );

    const created = await useCase.execute(
      createInput({
        sourceEventKey: 'manual:business-transaction:cash-initial:1',
        settlementMethod: 'cash',
      }),
    );
    const saved = await repository.getById(created.id);
    const recognitionEntry = created.recognitionLedgerEntryId
      ? await ledgerEntryRepository.getById(created.recognitionLedgerEntryId)
      : null;

    expect(saved).toBeTruthy();
    expect(created.status).toBe('confirmed');
    expect(created.commitmentIds).toEqual([]);
    expect(created.recognitionLedgerEntryId).toBeTruthy();
    expect(created.settlementLedgerEntryId).toBeUndefined();
    expect(recognitionEntry).toBeTruthy();
    expect(recognitionEntry?.referenceType).toBe('business_transaction_recognition');
    expect(recognitionEntry?.referenceId).toBe(created.id);
  });

  it('bloqueia duplicidade logica por (controlCenterId, sourceEventKey)', async () => {
    const repository = new InMemoryBusinessTransactionRepository([]);
    const commitmentRepository = new InMemoryCommitmentRepository([]);
    const ledgerAccountRepository = new InMemoryLedgerAccountRepository(createRootLedgerAccounts());
    const ledgerEntryRepository = new InMemoryLedgerEntryRepository([]);
    const useCase = new CreateBusinessTransactionUseCase(
      repository,
      commitmentRepository,
      ledgerAccountRepository,
      ledgerEntryRepository,
    );
    const input = createInput({ sourceEventKey: 'manual:business-transaction:dup:1' });

    await useCase.execute(input);
    await expect(useCase.execute(input)).rejects.toThrow(
      'Ja existe transacao para este sourceEventKey no centro de controle.',
    );
    expect((await ledgerEntryRepository.listByControlCenter('cc-1')).length).toBe(1);
  });

  it('falha sem sourceEventKey', async () => {
    const repository = new InMemoryBusinessTransactionRepository([]);
    const commitmentRepository = new InMemoryCommitmentRepository([]);
    const useCase = new CreateBusinessTransactionUseCase(
      repository,
      commitmentRepository,
      new InMemoryLedgerAccountRepository(createRootLedgerAccounts()),
      new InMemoryLedgerEntryRepository([]),
    );

    await expect(
      useCase.execute(createInput({ sourceEventKey: '   ' })),
    ).rejects.toThrow('sourceEventKey e obrigatorio para idempotencia.');
  });

  it('falha sem counterpartyId', async () => {
    const repository = new InMemoryBusinessTransactionRepository([]);
    const commitmentRepository = new InMemoryCommitmentRepository([]);
    const useCase = new CreateBusinessTransactionUseCase(
      repository,
      commitmentRepository,
      new InMemoryLedgerAccountRepository(createRootLedgerAccounts()),
      new InMemoryLedgerEntryRepository([]),
    );

    await expect(
      useCase.execute(createInput({ counterpartyId: '   ' })),
    ).rejects.toThrow('counterpartyId e obrigatorio para BusinessTransaction.');
  });

  it('falha com amountCents invalido', async () => {
    const repository = new InMemoryBusinessTransactionRepository([]);
    const commitmentRepository = new InMemoryCommitmentRepository([]);
    const useCase = new CreateBusinessTransactionUseCase(
      repository,
      commitmentRepository,
      new InMemoryLedgerAccountRepository(createRootLedgerAccounts()),
      new InMemoryLedgerEntryRepository([]),
    );

    await expect(
      useCase.execute(createInput({ amountCents: 10.2 })),
    ).rejects.toThrow('amountCents deve ser inteiro em centavos.');
  });

  it('falha com documentDate futura quando confirmado', async () => {
    const repository = new InMemoryBusinessTransactionRepository([]);
    const commitmentRepository = new InMemoryCommitmentRepository([]);
    const useCase = new CreateBusinessTransactionUseCase(
      repository,
      commitmentRepository,
      new InMemoryLedgerAccountRepository(createRootLedgerAccounts()),
      new InMemoryLedgerEntryRepository([]),
    );

    await expect(
      useCase.execute(createInput({ documentDate: isoDateFromToday(1) })),
    ).rejects.toThrow('documentDate nao pode estar no futuro para transacao confirmada.');
  });

  it('falha com dueDate anterior a documentDate', async () => {
    const repository = new InMemoryBusinessTransactionRepository([]);
    const commitmentRepository = new InMemoryCommitmentRepository([]);
    const useCase = new CreateBusinessTransactionUseCase(
      repository,
      commitmentRepository,
      new InMemoryLedgerAccountRepository(createRootLedgerAccounts()),
      new InMemoryLedgerEntryRepository([]),
    );

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
    const repository = new InMemoryBusinessTransactionRepository([]);
    const commitmentRepository = new InMemoryCommitmentRepository([]);
    const useCase = new CreateBusinessTransactionUseCase(
      repository,
      commitmentRepository,
      new InMemoryLedgerAccountRepository(createRootLedgerAccounts()),
      new InMemoryLedgerEntryRepository([]),
    );

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
    const repository = new InMemoryBusinessTransactionRepository([]);
    const commitmentRepository = new InMemoryCommitmentRepository([]);
    const useCase = new CreateBusinessTransactionUseCase(
      repository,
      commitmentRepository,
      new InMemoryLedgerAccountRepository(createRootLedgerAccounts()),
      new InMemoryLedgerEntryRepository([]),
    );

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
    const repository = new InMemoryBusinessTransactionRepository([]);
    const commitmentRepository = new InMemoryCommitmentRepository([]);
    const useCase = new CreateBusinessTransactionUseCase(
      repository,
      commitmentRepository,
      new InMemoryLedgerAccountRepository(createRootLedgerAccounts()),
      new InMemoryLedgerEntryRepository([]),
    );

    await expect(
      useCase.execute(
        createInput({
          settlementMethod: 'credit_card',
          creditCardId: undefined,
        }),
      ),
    ).rejects.toThrow('creditCardId e obrigatorio quando settlementMethod = credit_card.');
  });

  it('gera reconhecimento para contexto a vista, a prazo e cartao sem liquidar caixa neste step', async () => {
    const repository = new InMemoryBusinessTransactionRepository([]);
    const commitmentRepository = new InMemoryCommitmentRepository([]);
    const ledgerEntryRepository = new InMemoryLedgerEntryRepository([]);
    const useCase = new CreateBusinessTransactionUseCase(
      repository,
      commitmentRepository,
      new InMemoryLedgerAccountRepository(createRootLedgerAccounts()),
      ledgerEntryRepository,
    );

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
      }),
    );

    const entries = await ledgerEntryRepository.listByControlCenter('cc-1');
    expect(entries).toHaveLength(3);
    expect(cash.recognitionLedgerEntryId).toBeTruthy();
    expect(term.recognitionLedgerEntryId).toBeTruthy();
    expect(card.recognitionLedgerEntryId).toBeTruthy();
    expect(cash.settlementLedgerEntryId).toBeUndefined();
    expect(term.settlementLedgerEntryId).toBeUndefined();
    expect(card.settlementLedgerEntryId).toBeUndefined();

    const commitments = await commitmentRepository.listByControlCenter('cc-1');
    expect(cash.commitmentIds).toEqual([]);
    expect(card.commitmentIds).toEqual([]);
    expect(term.commitmentIds).toHaveLength(1);
    expect(commitments).toHaveLength(1);
    expect(commitments[0].sourceEventKey).toBe('manual:business-transaction:term:1:commitment:1');
    expect(commitments[0].installmentNumber).toBe(1);
    expect(commitments[0].installmentCount).toBe(1);
  });
});
