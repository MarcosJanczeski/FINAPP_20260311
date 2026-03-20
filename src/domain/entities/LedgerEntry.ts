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
  referenceType:
    | 'account_opening'
    | 'account_opening_reversal'
    | 'account_opening_adjustment'
    | 'recurrence_recognition'
    | 'business_transaction_recognition'
    | 'recurrence_settlement_adjustment'
    | 'recurrence_settlement'
    | 'recurrence_reversal'
    | 'recurrence_settlement_reversal';
  referenceId: ID;
  reversalOf?: ID;
  lines: LedgerEntryLine[];
  createdByUserId?: ID;
  reason?: string;
  createdAt: ISODateString;
}
