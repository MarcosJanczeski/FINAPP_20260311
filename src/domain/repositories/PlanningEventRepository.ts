import type { PlanningEvent } from '../entities/PlanningEvent';
import type { ID } from '../types/common';

export interface PlanningEventRepository {
  getById(id: ID): Promise<PlanningEvent | null>;
  listByControlCenter(controlCenterId: ID): Promise<PlanningEvent[]>;
  save(event: PlanningEvent): Promise<void>;
}
