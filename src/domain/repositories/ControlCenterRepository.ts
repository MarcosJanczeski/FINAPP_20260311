import type { ControlCenter } from '../entities/ControlCenter';
import type { ID } from '../types/common';

export interface ControlCenterRepository {
  getById(id: ID): Promise<ControlCenter | null>;
  listByUser(userId: ID): Promise<ControlCenter[]>;
  save(center: ControlCenter): Promise<void>;
  delete(id: ID): Promise<void>;
}
