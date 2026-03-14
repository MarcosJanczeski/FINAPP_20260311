import type { LedgerEntry } from '../entities/LedgerEntry';
import type { ID } from '../types/common';

export interface LedgerEntryRepository {
  getById(id: ID): Promise<LedgerEntry | null>;
  listByControlCenter(controlCenterId: ID): Promise<LedgerEntry[]>;
  save(entry: LedgerEntry): Promise<void>;
}
