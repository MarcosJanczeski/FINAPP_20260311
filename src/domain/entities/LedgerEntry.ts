import type { ID, ISODateString } from '../types/common';

export interface LedgerEntryLine {
  ledgerAccountId: ID;
  debitCents: number;
  creditCents: number;
}

export interface LedgerEntry {
  id: ID;
  controlCenterId: ID;
  date: ISODateString;
  description: string;
  referenceType: 'account_opening' | 'account_opening_reversal' | 'account_opening_adjustment';
  referenceId: ID;
  lines: LedgerEntryLine[];
  createdByUserId?: ID;
  reason?: string;
  createdAt: ISODateString;
}
