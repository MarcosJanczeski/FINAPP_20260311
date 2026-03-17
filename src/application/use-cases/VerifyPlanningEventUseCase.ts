import type { PlanningEvent } from '../../domain/entities/PlanningEvent';
import type { PlanningEventRepository } from '../../domain/repositories/PlanningEventRepository';
import type { ID } from '../../domain/types/common';
import { resolvePlanningEventOperationalSnapshot } from '../services/planningEventOperationalResolver';

interface VerifyPlanningEventInput {
  id: ID;
  controlCenterId: ID;
  verifiedByUserId: ID;
}

export class VerifyPlanningEventUseCase {
  constructor(private readonly planningEventRepository: PlanningEventRepository) {}

  async execute(input: VerifyPlanningEventInput): Promise<PlanningEvent> {
    const event = await this.planningEventRepository.getById(input.id);
    if (!event || event.controlCenterId !== input.controlCenterId) {
      throw new Error('Evento de planejamento nao encontrado.');
    }

    const snapshot = resolvePlanningEventOperationalSnapshot(event);
    if (snapshot.state !== 'realizado') {
      throw new Error('Apenas eventos realizados podem ser marcados como conferidos.');
    }
    if (event.isVerified) {
      throw new Error('Evento ja esta conferido.');
    }

    const now = new Date().toISOString();
    const updated: PlanningEvent = {
      ...event,
      isVerified: true,
      verifiedAt: now,
      verifiedByUserId: input.verifiedByUserId,
      updatedAt: now,
    };

    await this.planningEventRepository.save(updated);
    return updated;
  }
}
