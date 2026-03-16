import type { PlanningEvent } from '../../domain/entities/PlanningEvent';
import type { PlanningEventRepository } from '../../domain/repositories/PlanningEventRepository';
import type { ID } from '../../domain/types/common';

export interface PlanningEventListItem extends PlanningEvent {
  isCancelable: boolean;
  isCancelReversible: boolean;
}

export class ListPlanningEventsUseCase {
  constructor(private readonly planningEventRepository: PlanningEventRepository) {}

  async execute(controlCenterId: ID): Promise<PlanningEventListItem[]> {
    const events = await this.planningEventRepository.listByControlCenter(controlCenterId);
    return events.map((event) => ({
      ...event,
      isCancelable: this.isCancelable(event),
      isCancelReversible: this.isCancelReversible(event),
    }));
  }

  private isCancelable(event: PlanningEvent): boolean {
    if (event.sourceType !== 'recurrence') {
      return false;
    }
    if (event.status === 'canceled') {
      return false;
    }
    if (event.type === 'previsto_recorrencia' && event.status === 'active') {
      return true;
    }
    return event.type === 'confirmado_agendado' || event.type === 'realizado';
  }

  private isCancelReversible(event: PlanningEvent): boolean {
    return (
      event.sourceType === 'recurrence' &&
      event.type === 'previsto_recorrencia' &&
      event.status === 'canceled'
    );
  }
}
