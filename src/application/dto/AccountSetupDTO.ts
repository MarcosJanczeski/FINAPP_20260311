import type { Account } from '../../domain/entities/Account';
import type { LedgerAccount } from '../../domain/entities/LedgerAccount';
import type { LedgerEntry } from '../../domain/entities/LedgerEntry';
import type { ID } from '../../domain/types/common';

export interface CreateAccountInputDTO {
  controlCenterId: ID;
  name: string;
  type: Account['type'];
  nature: Account['nature'];
  ledgerAccountId: ID;
  openingBalanceCents: number;
}

export interface AccountsSetupDTO {
  controlCenterId: ID;
  accounts: Account[];
  ledgerAccounts: LedgerAccount[];
  openingEntries: LedgerEntry[];
}
