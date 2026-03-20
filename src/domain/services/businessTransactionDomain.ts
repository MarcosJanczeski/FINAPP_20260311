import type { BusinessTransaction } from '../entities/BusinessTransaction';

function parseIsoDateOrThrow(value: string, label: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} invalida.`);
  }
  return parsed;
}

export function validateBusinessTransactionIdentity(
  transaction: Pick<BusinessTransaction, 'sourceEventKey' | 'counterpartyId' | 'controlCenterId'>,
): void {
  if (!transaction.controlCenterId.trim()) {
    throw new Error('controlCenterId e obrigatorio.');
  }
  if (!transaction.sourceEventKey.trim()) {
    throw new Error('sourceEventKey e obrigatorio para idempotencia.');
  }
  if (!transaction.counterpartyId.trim()) {
    throw new Error('counterpartyId e obrigatorio para BusinessTransaction.');
  }
}

export function validateBusinessTransactionAmounts(
  transaction: Pick<BusinessTransaction, 'amountCents'>,
): void {
  if (!Number.isInteger(transaction.amountCents)) {
    throw new Error('amountCents deve ser inteiro em centavos.');
  }
  if (transaction.amountCents <= 0) {
    throw new Error('amountCents deve ser maior que zero.');
  }
}

export function validateBusinessTransactionDates(
  transaction: Pick<BusinessTransaction, 'documentDate' | 'dueDate' | 'status'>,
  now: Date = new Date(),
): void {
  const documentDate = parseIsoDateOrThrow(transaction.documentDate, 'documentDate');

  if (transaction.status === 'confirmed' && documentDate.getTime() > now.getTime()) {
    throw new Error('documentDate nao pode estar no futuro para transacao confirmada.');
  }

  if (!transaction.dueDate) {
    return;
  }

  const dueDate = parseIsoDateOrThrow(transaction.dueDate, 'dueDate');
  if (dueDate.getTime() < documentDate.getTime()) {
    throw new Error('dueDate nao pode ser anterior a documentDate.');
  }
}

export function validateBusinessTransactionInstallments(
  transaction: Pick<BusinessTransaction, 'installmentCount' | 'installmentPeriodicity'>,
): void {
  if (!Number.isInteger(transaction.installmentCount)) {
    throw new Error('installmentCount deve ser inteiro.');
  }
  if (transaction.installmentCount < 1) {
    throw new Error('installmentCount deve ser maior ou igual a 1.');
  }
  if (transaction.installmentCount > 1 && !transaction.installmentPeriodicity) {
    throw new Error('installmentPeriodicity e obrigatoria quando installmentCount > 1.');
  }
}

export function validateBusinessTransactionSettlementContext(
  transaction: Pick<BusinessTransaction, 'settlementMethod' | 'creditCardId'>,
): void {
  if (transaction.settlementMethod === 'credit_card' && !transaction.creditCardId?.trim()) {
    throw new Error('creditCardId e obrigatorio quando settlementMethod = credit_card.');
  }
}
