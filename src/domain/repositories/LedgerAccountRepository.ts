import type { LedgerAccount } from '../entities/LedgerAccount';
import type { ID } from '../types/common';

export interface LedgerAccountRepository {
  getById(id: ID): Promise<LedgerAccount | null>;
  getByCode(controlCenterId: ID, code: string): Promise<LedgerAccount | null>;
  listByControlCenter(controlCenterId: ID): Promise<LedgerAccount[]>;
  save(account: LedgerAccount): Promise<void>;
}
