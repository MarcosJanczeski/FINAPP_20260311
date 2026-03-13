import type { ID, ISODateString } from '../types/common';

export type AccountType = 'cash' | 'checking' | 'digital' | 'investment' | 'other';
export type AccountNature = 'asset' | 'liability';
export type AccountStatus = 'active' | 'closed';

export interface Account {
  id: ID;
  controlCenterId: ID;
  name: string;
  type: AccountType;
  nature: AccountNature;
  ledgerAccountId: ID;
  openingBalanceCents: number;
  status: AccountStatus;
  closedAt: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
