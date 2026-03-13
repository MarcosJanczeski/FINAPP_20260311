import type { PlanningEvent } from '../../domain/entities/PlanningEvent';
import type { PlanningEventRepository } from '../../domain/repositories/PlanningEventRepository';
import type { ID } from '../../domain/types/common';

export class ListPlanningEventsUseCase {
  constructor(private readonly planningEventRepository: PlanningEventRepository) {}

  async execute(controlCenterId: ID): Promise<PlanningEvent[]> {
    return this.planningEventRepository.listByControlCenter(controlCenterId);
  }
}
