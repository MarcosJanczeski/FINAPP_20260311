import type { ID, ISODateString } from '../types/common';

export type BusinessTransactionType =
  | 'purchase'
  | 'sale'
  | 'service_contract'
  | 'financing_contract'
  | 'installment_operation'
  | 'other';

export type BusinessTransactionStatus = 'draft' | 'confirmed';

export type SettlementMethod = 'cash' | 'bank_account' | 'credit_card' | 'other';

export type InstallmentPeriodicity = 'monthly' | 'weekly' | 'biweekly' | 'yearly' | 'other';

export interface BusinessTransaction {
  id: ID;
  controlCenterId: ID;
  sourceEventKey: string;
  type: BusinessTransactionType;
  description: string;
  counterpartyId: ID;
  documentDate: ISODateString;
  dueDate?: ISODateString;
  amountCents: number;
  settlementMethod: SettlementMethod;
  expectedSettlementAccountId?: ID;
  creditCardId?: ID;
  creditCardClosingDay?: number;
  creditCardDueDay?: number;
  installmentCount: number;
  installmentPeriodicity?: InstallmentPeriodicity;
  recognitionLedgerEntryId?: ID;
  settlementLedgerEntryId?: ID;
  commitmentIds: ID[];
  status: BusinessTransactionStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  createdByUserId: ID;
  notes?: string;
}
