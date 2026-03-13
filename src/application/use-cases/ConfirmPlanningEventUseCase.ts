import type { PlanningEvent } from '../../domain/entities/PlanningEvent';
import type { PlanningEventRepository } from '../../domain/repositories/PlanningEventRepository';
import type { ID } from '../../domain/types/common';

interface ConfirmPlanningEventInput {
  id: ID;
  controlCenterId: ID;
}

export class ConfirmPlanningEventUseCase {
  constructor(private readonly planningEventRepository: PlanningEventRepository) {}

  async execute(input: ConfirmPlanningEventInput): Promise<PlanningEvent> {
    const event = await this.planningEventRepository.getById(input.id);
    if (!event || event.controlCenterId !== input.controlCenterId) {
      throw new Error('Evento de planejamento nao encontrado.');
    }

    if (event.status === 'posted') {
      throw new Error('Evento postado nao pode voltar para confirmado.');
    }

    if (event.status === 'canceled') {
      throw new Error('Evento cancelado nao pode ser confirmado.');
    }

    const updated: PlanningEvent = {
      ...event,
      status: 'confirmed',
      updatedAt: new Date().toISOString(),
    };

    await this.planningEventRepository.save(updated);
    return updated;
  }
}
