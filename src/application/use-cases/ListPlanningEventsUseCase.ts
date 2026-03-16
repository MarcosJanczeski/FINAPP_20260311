import type { PlanningEvent } from '../../domain/entities/PlanningEvent';
import type { PlanningEventRepository } from '../../domain/repositories/PlanningEventRepository';
import type { ID } from '../../domain/types/common';
import {
  resolvePlanningEventOperationalSnapshot,
  type PlanningEventOperationalState,
} from '../services/planningEventOperationalResolver';

export interface PlanningEventListItem extends PlanningEvent {
  operationalState: PlanningEventOperationalState;
  isCancelable: boolean;
  isCancelReversible: boolean;
  canReverseSettlement: boolean;
  canReverseConfirmation: boolean;
}

export class ListPlanningEventsUseCase {
  constructor(private readonly planningEventRepository: PlanningEventRepository) {}

  async execute(controlCenterId: ID): Promise<PlanningEventListItem[]> {
    const events = await this.planningEventRepository.listByControlCenter(controlCenterId);
    return events.map((event) => {
      const snapshot = resolvePlanningEventOperationalSnapshot(event);
      return {
        ...event,
        operationalState: snapshot.state,
        isCancelable: snapshot.capabilities.isCancelable,
        isCancelReversible: snapshot.capabilities.isCancelReversible,
        canReverseSettlement: snapshot.capabilities.canReverseSettlement,
        canReverseConfirmation: snapshot.capabilities.canReverseConfirmation,
      };
    });
  }
}
