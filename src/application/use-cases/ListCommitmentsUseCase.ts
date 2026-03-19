import type { Commitment } from '../../domain/entities/Commitment';
import type {
  CommitmentListFilters,
  CommitmentRepository,
} from '../../domain/repositories/CommitmentRepository';
import type { ID } from '../../domain/types/common';

export class ListCommitmentsUseCase {
  constructor(private readonly commitmentRepository: CommitmentRepository) {}

  async execute(controlCenterId: ID, filters?: CommitmentListFilters): Promise<Commitment[]> {
    return this.commitmentRepository.listByControlCenter(controlCenterId, filters);
  }
}
