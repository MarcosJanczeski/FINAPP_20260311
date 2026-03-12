import type { LedgerEntry } from '../entities/LedgerEntry';
import type { ID } from '../types/common';

export interface LedgerEntryRepository {
  listByControlCenter(controlCenterId: ID): Promise<LedgerEntry[]>;
  save(entry: LedgerEntry): Promise<void>;
}
