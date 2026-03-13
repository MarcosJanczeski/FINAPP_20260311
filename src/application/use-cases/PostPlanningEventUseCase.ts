import type { PlanningEvent } from '../../domain/entities/PlanningEvent';
import type { PlanningEventRepository } from '../../domain/repositories/PlanningEventRepository';
import type { ID } from '../../domain/types/common';

interface PostPlanningEventInput {
  id: ID;
  controlCenterId: ID;
  postedLedgerEntryId: ID;
}

export class PostPlanningEventUseCase {
  constructor(private readonly planningEventRepository: PlanningEventRepository) {}

  async execute(input: PostPlanningEventInput): Promise<PlanningEvent> {
    const event = await this.planningEventRepository.getById(input.id);
    if (!event || event.controlCenterId !== input.controlCenterId) {
      throw new Error('Evento de planejamento nao encontrado.');
    }

    if (event.status === 'canceled') {
      throw new Error('Evento cancelado nao pode ser postado.');
    }

    if (event.status !== 'confirmed') {
      throw new Error('Somente evento confirmado pode ser postado.');
    }

    const updated: PlanningEvent = {
      ...event,
      status: 'posted',
      postedLedgerEntryId: input.postedLedgerEntryId,
      updatedAt: new Date().toISOString(),
    };

    await this.planningEventRepository.save(updated);
    return updated;
  }
}
