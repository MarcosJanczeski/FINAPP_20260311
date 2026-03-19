import type { Commitment, CommitmentStatus, CommitmentType } from '../entities/Commitment';
import type { ID } from '../types/common';

export interface CommitmentListFilters {
  status?: CommitmentStatus;
  type?: CommitmentType;
  counterpartyId?: ID;
  categoryId?: ID;
}

export interface CommitmentRepository {
  save(commitment: Commitment): Promise<void>;
  getById(id: ID): Promise<Commitment | null>;
  listByControlCenter(controlCenterId: ID, filters?: CommitmentListFilters): Promise<Commitment[]>;
  findBySourceEventKey(controlCenterId: ID, sourceEventKey: string): Promise<Commitment | null>;
}
