import type { Account } from '../entities/Account';
import type { ID } from '../types/common';

export interface AccountRepository {
  getById(id: ID): Promise<Account | null>;
  listByControlCenter(controlCenterId: ID): Promise<Account[]>;
  save(account: Account): Promise<void>;
  delete(id: ID): Promise<void>;
}
