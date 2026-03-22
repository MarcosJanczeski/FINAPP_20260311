import type { ID, ISODateString } from '../types/common';

export type CommitmentType = 'payable' | 'receivable';
export type CommitmentStatus = 'confirmed' | 'settled';
export type CommitmentSourceType =
  | 'manual'
  | 'business_transaction'
  | 'recurrence_confirmation'
  | 'credit_card_purchase'
  | 'credit_card_invoice'
  | 'installment'
  | 'import'
  | 'adjustment';

export type CommitmentLedgerLinkType =
  | 'recognition'
  | 'adjustment'
  | 'settlement'
  | 'settlement_reversal'
  | 'recognition_reversal';

export interface CommitmentLedgerLink {
  ledgerEntryId: ID;
  relation: CommitmentLedgerLinkType;
  createdAt: ISODateString;
}

export interface Commitment {
  id: ID;
  controlCenterId: ID;
  type: CommitmentType;
  status: CommitmentStatus;
  description: string;
  amountCents: number;
  categoryId?: ID;
  counterpartyId: ID;
  documentDate: ISODateString;
  dueDate: ISODateString;
  plannedSettlementDate: ISODateString;
  settlementDate?: ISODateString;
  expectedAccountId?: ID;
  settledAccountId?: ID;
  sourceType: CommitmentSourceType;
  sourceId?: ID;
  sourceEventKey: string;
  originTransactionId?: ID;
  originLedgerEntryId?: ID;
  installmentGroupId?: ID;
  installmentNumber?: number;
  installmentCount?: number;
  installmentPeriodicity?: 'monthly' | 'weekly' | 'biweekly' | 'yearly' | 'other';
  ledgerLinks: CommitmentLedgerLink[];
  originalAmountCents: number;
  settledAmountCents?: number;
  settlementDifferenceCents?: number;
  settlementDifferenceReason?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  createdByUserId: ID;
  notes?: string;
}
