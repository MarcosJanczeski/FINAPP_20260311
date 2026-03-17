import type { PlanningEvent } from '../../domain/entities/PlanningEvent';
import type { PlanningEventRepository } from '../../domain/repositories/PlanningEventRepository';
import type { ID, ISODateString } from '../../domain/types/common';
import { resolvePlanningEventOperationalSnapshot } from '../services/planningEventOperationalResolver';

interface PostponePlanningEventSettlementInput {
  id: ID;
  controlCenterId: ID;
  plannedSettlementDate: ISODateString;
}

export class PostponePlanningEventSettlementUseCase {
  constructor(private readonly planningEventRepository: PlanningEventRepository) {}

  async execute(input: PostponePlanningEventSettlementInput): Promise<PlanningEvent> {
    const event = await this.planningEventRepository.getById(input.id);
    if (!event || event.controlCenterId !== input.controlCenterId) {
      throw new Error('Evento de planejamento nao encontrado.');
    }

    const snapshot = resolvePlanningEventOperationalSnapshot(event);
    if (!snapshot.capabilities.canPostponeSettlement) {
      throw new Error('Somente compromissos confirmados elegiveis podem ser adiados.');
    }

    const updated: PlanningEvent = {
      ...event,
      plannedSettlementDate: input.plannedSettlementDate,
      updatedAt: new Date().toISOString(),
    };

    await this.planningEventRepository.save(updated);
    return updated;
  }
}
