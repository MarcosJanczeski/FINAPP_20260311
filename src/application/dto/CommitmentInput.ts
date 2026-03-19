import type { CommitmentSourceType, CommitmentType } from '../../domain/entities/Commitment';

export interface CreateCommitmentInput {
  controlCenterId: string;
  type: CommitmentType;
  description: string;
  amountCents: number;
  categoryId?: string;
  counterpartyId: string;
  documentDate: string;
  dueDate: string;
  plannedSettlementDate: string;
  expectedAccountId?: string;
  sourceType: CommitmentSourceType;
  sourceId?: string;
  sourceEventKey: string;
  createdByUserId: string;
  notes?: string;
}

export interface SettleCommitmentInput {
  commitmentId: string;
  settlementDate: string;
  settledAmountCents: number;
  settledAccountId?: string;
  settlementDifferenceReason?: string;
}

export interface ReverseCommitmentSettlementInput {
  commitmentId: string;
  reversalDate: string;
  reason: string;
}
