import { describe, expect, it } from 'vitest';
import type { CreateBusinessTransactionInput } from '../../dto/BusinessTransactionInput';
import { CreateBusinessTransactionUseCase } from '../CreateBusinessTransactionUseCase';
import type { BusinessTransaction } from '../../../domain/entities/BusinessTransaction';
import type { BusinessTransactionRepository } from '../../../domain/repositories/BusinessTransactionRepository';

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
    const useCase = new CreateBusinessTransactionUseCase(repository);

    const created = await useCase.execute(createInput());
    const saved = await repository.getById(created.id);

    expect(saved).toBeTruthy();
    expect(created.status).toBe('confirmed');
    expect(created.commitmentIds).toEqual([]);
    expect(created.recognitionLedgerEntryId).toBeUndefined();
    expect(created.settlementLedgerEntryId).toBeUndefined();
  });

  it('bloqueia duplicidade logica por (controlCenterId, sourceEventKey)', async () => {
    const repository = new InMemoryBusinessTransactionRepository([]);
    const useCase = new CreateBusinessTransactionUseCase(repository);
    const input = createInput({ sourceEventKey: 'manual:business-transaction:dup:1' });

    await useCase.execute(input);
    await expect(useCase.execute(input)).rejects.toThrow(
      'Ja existe transacao para este sourceEventKey no centro de controle.',
    );
  });

  it('falha sem sourceEventKey', async () => {
    const repository = new InMemoryBusinessTransactionRepository([]);
    const useCase = new CreateBusinessTransactionUseCase(repository);

    await expect(
      useCase.execute(createInput({ sourceEventKey: '   ' })),
    ).rejects.toThrow('sourceEventKey e obrigatorio para idempotencia.');
  });

  it('falha sem counterpartyId', async () => {
    const repository = new InMemoryBusinessTransactionRepository([]);
    const useCase = new CreateBusinessTransactionUseCase(repository);

    await expect(
      useCase.execute(createInput({ counterpartyId: '   ' })),
    ).rejects.toThrow('counterpartyId e obrigatorio para BusinessTransaction.');
  });

  it('falha com amountCents invalido', async () => {
    const repository = new InMemoryBusinessTransactionRepository([]);
    const useCase = new CreateBusinessTransactionUseCase(repository);

    await expect(
      useCase.execute(createInput({ amountCents: 10.2 })),
    ).rejects.toThrow('amountCents deve ser inteiro em centavos.');
  });

  it('falha com documentDate futura quando confirmado', async () => {
    const repository = new InMemoryBusinessTransactionRepository([]);
    const useCase = new CreateBusinessTransactionUseCase(repository);

    await expect(
      useCase.execute(createInput({ documentDate: isoDateFromToday(1) })),
    ).rejects.toThrow('documentDate nao pode estar no futuro para transacao confirmada.');
  });

  it('falha com dueDate anterior a documentDate', async () => {
    const repository = new InMemoryBusinessTransactionRepository([]);
    const useCase = new CreateBusinessTransactionUseCase(repository);

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
    const useCase = new CreateBusinessTransactionUseCase(repository);

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
    const useCase = new CreateBusinessTransactionUseCase(repository);

    const created = await useCase.execute(
      createInput({
        sourceEventKey: 'manual:business-transaction:installment:1',
        installmentCount: 12,
        installmentPeriodicity: 'monthly',
      }),
    );

    expect(created.installmentCount).toBe(12);
    expect(created.installmentPeriodicity).toBe('monthly');
    expect(created.commitmentIds).toEqual([]);
  });

  it('falha quando settlementMethod = credit_card e creditCardId ausente', async () => {
    const repository = new InMemoryBusinessTransactionRepository([]);
    const useCase = new CreateBusinessTransactionUseCase(repository);

    await expect(
      useCase.execute(
        createInput({
          settlementMethod: 'credit_card',
          creditCardId: undefined,
        }),
      ),
    ).rejects.toThrow('creditCardId e obrigatorio quando settlementMethod = credit_card.');
  });
});
