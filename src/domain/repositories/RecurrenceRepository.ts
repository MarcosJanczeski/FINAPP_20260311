import type { Recurrence } from '../entities/Recurrence';
import type { ID } from '../types/common';

export interface RecurrenceRepository {
  getById(id: ID): Promise<Recurrence | null>;
  listByControlCenter(controlCenterId: ID): Promise<Recurrence[]>;
  save(recurrence: Recurrence): Promise<void>;
}
