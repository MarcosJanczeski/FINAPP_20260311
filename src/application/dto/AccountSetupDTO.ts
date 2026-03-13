import type { Account } from '../../domain/entities/Account';
import type { LedgerAccount } from '../../domain/entities/LedgerAccount';
import type { LedgerEntry } from '../../domain/entities/LedgerEntry';
import type { ID } from '../../domain/types/common';

export interface CreateAccountInputDTO {
  controlCenterId: ID;
  createdByUserId: ID;
  name: string;
  type: Account['type'];
  nature: Account['nature'];
  ledgerAccountId: ID;
  openingBalanceCents: number;
}

export interface UpdateAccountProfileInputDTO {
  controlCenterId: ID;
  accountId: ID;
  name: string;
  type: Account['type'];
}

export interface AdjustAccountOpeningInputDTO {
  controlCenterId: ID;
  accountId: ID;
  updatedByUserId: ID;
  nature: Account['nature'];
  ledgerAccountId: ID;
  openingBalanceCents: number;
  reason: string;
}

export interface DeleteAccountInputDTO {
  controlCenterId: ID;
  accountId: ID;
}

export interface AccountsSetupDTO {
  controlCenterId: ID;
  accounts: Account[];
  ledgerAccounts: LedgerAccount[];
  ledgerEntries: LedgerEntry[];
}
