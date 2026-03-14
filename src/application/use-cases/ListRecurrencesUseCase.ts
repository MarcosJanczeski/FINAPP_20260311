import type { Recurrence } from '../../domain/entities/Recurrence';
import type { RecurrenceRepository } from '../../domain/repositories/RecurrenceRepository';
import type { ID } from '../../domain/types/common';

export class ListRecurrencesUseCase {
  constructor(private readonly recurrenceRepository: RecurrenceRepository) {}

  async execute(controlCenterId: ID): Promise<Recurrence[]> {
    return this.recurrenceRepository.listByControlCenter(controlCenterId);
  }
}
