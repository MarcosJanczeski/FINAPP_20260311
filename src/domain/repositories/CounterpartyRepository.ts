import type { Counterparty } from '../entities/Counterparty';
import type { ID } from '../types/common';

export interface CounterpartyRepository {
  getById(id: ID): Promise<Counterparty | null>;
  listByControlCenter(controlCenterId: ID): Promise<Counterparty[]>;
  searchByName(controlCenterId: ID, nameQuery: string): Promise<Counterparty[]>;
  findByNormalizedDocument(controlCenterId: ID, normalizedDocument: string): Promise<Counterparty[]>;
  save(counterparty: Counterparty): Promise<void>;
  delete(id: ID): Promise<void>;
}
