import type {
  BusinessTransactionStatus,
  BusinessTransactionType,
  InstallmentPeriodicity,
  SettlementMethod,
} from '../../domain/entities/BusinessTransaction';

export interface CreateBusinessTransactionInput {
  controlCenterId: string;
  sourceEventKey: string;
  type: BusinessTransactionType;
  description: string;
  counterpartyId: string;
  documentDate: string;
  dueDate?: string;
  amountCents: number;
  settlementMethod: SettlementMethod;
  expectedSettlementAccountId?: string;
  creditCardId?: string;
  creditCardClosingDay?: number;
  creditCardDueDay?: number;
  installmentCount: number;
  installmentPeriodicity?: InstallmentPeriodicity;
  notes?: string;
  createdByUserId: string;
}

export interface ConfirmBusinessTransactionInput {
  transactionId: string;
  confirmedAt: string;
}

export interface ListBusinessTransactionsInput {
  controlCenterId: string;
  status?: BusinessTransactionStatus;
  type?: BusinessTransactionType;
  settlementMethod?: SettlementMethod;
  counterpartyId?: string;
}
