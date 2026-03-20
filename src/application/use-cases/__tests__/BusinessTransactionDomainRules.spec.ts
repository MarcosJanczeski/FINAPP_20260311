import { describe, expect, it } from 'vitest';
import type { BusinessTransaction } from '../../../domain/entities/BusinessTransaction';
import {
  validateBusinessTransactionAmounts,
  validateBusinessTransactionDates,
  validateBusinessTransactionIdentity,
  validateBusinessTransactionInstallments,
  validateBusinessTransactionSettlementContext,
} from '../../../domain/services/businessTransactionDomain';

function isoDateFromToday(daysFromNow: number): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysFromNow, 12, 0, 0),
  ).toISOString();
}

function buildTransaction(overrides: Partial<BusinessTransaction> = {}): BusinessTransaction {
  return {
    id: overrides.id ?? 'tx-1',
    controlCenterId: overrides.controlCenterId ?? 'cc-1',
    sourceEventKey: overrides.sourceEventKey ?? 'manual:business-transaction:1',
    type: overrides.type ?? 'purchase',
    description: overrides.description ?? 'Compra operacional',
    counterpartyId: overrides.counterpartyId ?? 'cp-1',
    documentDate: overrides.documentDate ?? isoDateFromToday(-1),
    dueDate: overrides.dueDate ?? isoDateFromToday(5),
    amountCents: overrides.amountCents ?? 15000,
    settlementMethod: overrides.settlementMethod ?? 'bank_account',
    expectedSettlementAccountId: overrides.expectedSettlementAccountId ?? 'acc-1',
    creditCardId: overrides.creditCardId,
    installmentCount: overrides.installmentCount ?? 1,
    installmentPeriodicity: overrides.installmentPeriodicity,
    recognitionLedgerEntryId: overrides.recognitionLedgerEntryId,
    settlementLedgerEntryId: overrides.settlementLedgerEntryId,
    commitmentIds: overrides.commitmentIds ?? [],
    status: overrides.status ?? 'confirmed',
    createdAt: overrides.createdAt ?? isoDateFromToday(-1),
    updatedAt: overrides.updatedAt ?? isoDateFromToday(-1),
    createdByUserId: overrides.createdByUserId ?? 'user-1',
    notes: overrides.notes,
  };
}

describe('BusinessTransaction domain rules', () => {
  it('transacao valida com counterparty obrigatoria', () => {
    const transaction = buildTransaction({ counterpartyId: 'cp-abc' });

    validateBusinessTransactionIdentity(transaction);
    validateBusinessTransactionAmounts(transaction);
    validateBusinessTransactionDates(transaction);
    validateBusinessTransactionInstallments(transaction);
    validateBusinessTransactionSettlementContext(transaction);
  });

  it('falha sem sourceEventKey', () => {
    const transaction = buildTransaction({ sourceEventKey: '   ' });
    expect(() => validateBusinessTransactionIdentity(transaction)).toThrow(
      'sourceEventKey e obrigatorio para idempotencia.',
    );
  });

  it('falha sem counterpartyId', () => {
    const transaction = buildTransaction({ counterpartyId: '   ' });
    expect(() => validateBusinessTransactionIdentity(transaction)).toThrow(
      'counterpartyId e obrigatorio para BusinessTransaction.',
    );
  });

  it('falha com amountCents invalido', () => {
    const notInteger = buildTransaction({ amountCents: 10.5 });
    expect(() => validateBusinessTransactionAmounts(notInteger)).toThrow(
      'amountCents deve ser inteiro em centavos.',
    );

    const notPositive = buildTransaction({ amountCents: 0 });
    expect(() => validateBusinessTransactionAmounts(notPositive)).toThrow(
      'amountCents deve ser maior que zero.',
    );
  });

  it('falha com documentDate futura quando confirmado', () => {
    const transaction = buildTransaction({
      status: 'confirmed',
      documentDate: isoDateFromToday(1),
    });

    expect(() => validateBusinessTransactionDates(transaction)).toThrow(
      'documentDate nao pode estar no futuro para transacao confirmada.',
    );
  });

  it('falha com dueDate anterior a documentDate', () => {
    const transaction = buildTransaction({
      documentDate: isoDateFromToday(-1),
      dueDate: isoDateFromToday(-2),
    });

    expect(() => validateBusinessTransactionDates(transaction)).toThrow(
      'dueDate nao pode ser anterior a documentDate.',
    );
  });

  it('falha com installmentCount < 1', () => {
    const transaction = buildTransaction({ installmentCount: 0 });
    expect(() => validateBusinessTransactionInstallments(transaction)).toThrow(
      'installmentCount deve ser maior ou igual a 1.',
    );
  });

  it('aceita installmentCount = 1 sem periodicidade', () => {
    const transaction = buildTransaction({
      installmentCount: 1,
      installmentPeriodicity: undefined,
    });
    validateBusinessTransactionInstallments(transaction);
  });

  it('aceita installmentCount > 1 com periodicidade', () => {
    const transaction = buildTransaction({
      installmentCount: 6,
      installmentPeriodicity: 'monthly',
    });
    validateBusinessTransactionInstallments(transaction);
  });

  it('falha quando settlementMethod = credit_card sem creditCardId', () => {
    const transaction = buildTransaction({
      settlementMethod: 'credit_card',
      creditCardId: undefined,
    });

    expect(() => validateBusinessTransactionSettlementContext(transaction)).toThrow(
      'creditCardId e obrigatorio quando settlementMethod = credit_card.',
    );
  });
});
