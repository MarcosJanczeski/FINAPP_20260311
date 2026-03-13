import type { PlanningEvent } from '../../domain/entities/PlanningEvent';
import type { PlanningEventRepository } from '../../domain/repositories/PlanningEventRepository';
import type { ID } from '../../domain/types/common';

interface CancelPlanningEventInput {
  id: ID;
  controlCenterId: ID;
}

export class CancelPlanningEventUseCase {
  constructor(private readonly planningEventRepository: PlanningEventRepository) {}

  async execute(input: CancelPlanningEventInput): Promise<PlanningEvent> {
    const event = await this.planningEventRepository.getById(input.id);
    if (!event || event.controlCenterId !== input.controlCenterId) {
      throw new Error('Evento de planejamento nao encontrado.');
    }

    if (event.status === 'posted') {
      throw new Error('Evento postado nao pode ser cancelado.');
    }

    const updated: PlanningEvent = {
      ...event,
      status: 'canceled',
      updatedAt: new Date().toISOString(),
    };

    await this.planningEventRepository.save(updated);
    return updated;
  }
}
