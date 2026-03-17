import type { PlanningEvent } from '../../domain/entities/PlanningEvent';
import type { PlanningEventRepository } from '../../domain/repositories/PlanningEventRepository';
import type { ID } from '../../domain/types/common';
import { resolvePlanningEventOperationalSnapshot } from '../services/planningEventOperationalResolver';

interface UnverifyPlanningEventInput {
  id: ID;
  controlCenterId: ID;
}

export class UnverifyPlanningEventUseCase {
  constructor(private readonly planningEventRepository: PlanningEventRepository) {}

  async execute(input: UnverifyPlanningEventInput): Promise<PlanningEvent> {
    const event = await this.planningEventRepository.getById(input.id);
    if (!event || event.controlCenterId !== input.controlCenterId) {
      throw new Error('Evento de planejamento nao encontrado.');
    }

    const snapshot = resolvePlanningEventOperationalSnapshot(event);
    if (snapshot.state !== 'realizado') {
      throw new Error('Apenas eventos realizados podem ter conferência ajustada.');
    }
    if (!event.isVerified) {
      throw new Error('Evento nao esta conferido.');
    }

    const now = new Date().toISOString();
    const updated: PlanningEvent = {
      ...event,
      isVerified: false,
      verifiedAt: null,
      verifiedByUserId: null,
      updatedAt: now,
    };

    await this.planningEventRepository.save(updated);
    return updated;
  }
}
