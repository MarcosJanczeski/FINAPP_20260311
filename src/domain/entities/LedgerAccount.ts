import type { ID, ISODateString } from '../types/common';

export type LedgerAccountKind = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export type LedgerAccountRole = 'grouping' | 'posting';
export type LedgerAccountStatus = 'active' | 'inactive';

export interface LedgerAccount {
  id: ID;
  controlCenterId: ID;
  code: string;
  name: string;
  kind: LedgerAccountKind;
  accountRole: LedgerAccountRole;
  parentLedgerAccountId: ID | null;
  status: LedgerAccountStatus;
  isSystem: boolean;
  createdAt: ISODateString;
}
