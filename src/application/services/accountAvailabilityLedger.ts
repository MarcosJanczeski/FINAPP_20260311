import type { LedgerEntry } from '../../domain/entities/LedgerEntry';
import type { ID, ISODateString } from '../../domain/types/common';

export interface AccountLedgerMovement {
  ledgerEntryId: ID;
  date: ISODateString;
  description: string;
  referenceType: string;
  referenceId: ID;
  debitCents: number;
  creditCents: number;
  movementCents: number;
  createdAt: ISODateString;
}

export function listAccountLedgerMovements(
  ledgerEntries: LedgerEntry[],
  ledgerAccountId: ID,
): AccountLedgerMovement[] {
  return ledgerEntries
    .map((entry) => {
      const debitCents = entry.lines
        .filter((line) => line.ledgerAccountId === ledgerAccountId)
        .reduce((sum, line) => sum + line.debitCents, 0);
      const creditCents = entry.lines
        .filter((line) => line.ledgerAccountId === ledgerAccountId)
        .reduce((sum, line) => sum + line.creditCents, 0);

      return {
        ledgerEntryId: entry.id,
        date: entry.date,
        description: entry.description,
        referenceType: entry.referenceType,
        referenceId: entry.referenceId,
        debitCents,
        creditCents,
        movementCents: debitCents - creditCents,
        createdAt: entry.createdAt,
      };
    })
    .filter((line) => line.debitCents > 0 || line.creditCents > 0)
    .sort((a, b) => {
      if (a.date !== b.date) {
        return a.date > b.date ? 1 : -1;
      }
      if (a.createdAt !== b.createdAt) {
        return a.createdAt > b.createdAt ? 1 : -1;
      }
      return a.ledgerEntryId > b.ledgerEntryId ? 1 : -1;
    });
}

export function getCurrentBalanceFromLedger(
  ledgerEntries: LedgerEntry[],
  ledgerAccountId: ID,
): number {
  return listAccountLedgerMovements(ledgerEntries, ledgerAccountId).reduce(
    (sum, movement) => sum + movement.movementCents,
    0,
  );
}
