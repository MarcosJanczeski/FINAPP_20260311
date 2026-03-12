import type { ID, ISODateString } from '../types/common';

export type AccountType = 'cash' | 'checking' | 'digital' | 'investment' | 'other';
export type AccountNature = 'asset' | 'liability';

export interface Account {
  id: ID;
  controlCenterId: ID;
  name: string;
  type: AccountType;
  nature: AccountNature;
  ledgerAccountId: ID;
  openingBalanceCents: number;
  createdAt: ISODateString;
}
