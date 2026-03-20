import type {
  BusinessTransaction,
  BusinessTransactionStatus,
  BusinessTransactionType,
  SettlementMethod,
} from '../entities/BusinessTransaction';
import type { ID } from '../types/common';

export interface BusinessTransactionListFilters {
  status?: BusinessTransactionStatus;
  type?: BusinessTransactionType;
  settlementMethod?: SettlementMethod;
  counterpartyId?: ID;
}

export interface BusinessTransactionRepository {
  save(transaction: BusinessTransaction): Promise<void>;
  getById(id: ID): Promise<BusinessTransaction | null>;
  listByControlCenter(
    controlCenterId: ID,
    filters?: BusinessTransactionListFilters,
  ): Promise<BusinessTransaction[]>;
  findBySourceEventKey(
    controlCenterId: ID,
    sourceEventKey: string,
  ): Promise<BusinessTransaction | null>;
}
