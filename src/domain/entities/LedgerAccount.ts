import type { ID, ISODateString } from '../types/common';

export type LedgerAccountKind = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export interface LedgerAccount {
  id: ID;
  controlCenterId: ID;
  code: string;
  name: string;
  kind: LedgerAccountKind;
  isSystem: boolean;
  createdAt: ISODateString;
}
