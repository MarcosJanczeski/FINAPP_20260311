import type { PlanningEvent } from '../../domain/entities/PlanningEvent';
import type { PlanningEventRepository } from '../../domain/repositories/PlanningEventRepository';
import type { ID } from '../../domain/types/common';

interface RevertRecurrenceOccurrenceCancellationInput {
  id: ID;
  controlCenterId: ID;
  revertedByUserId: ID;
}

export class RevertRecurrenceOccurrenceCancellationUseCase {
  constructor(private readonly planningEventRepository: PlanningEventRepository) {}

  async execute(input: RevertRecurrenceOccurrenceCancellationInput): Promise<PlanningEvent> {
    const event = await this.planningEventRepository.getById(input.id);
    if (!event || event.controlCenterId !== input.controlCenterId) {
      throw new Error('Ocorrencia de recorrencia nao encontrada.');
    }

    if (event.sourceType !== 'recurrence') {
      throw new Error('Somente ocorrencias de recorrencia podem ser revertidas neste fluxo.');
    }

    if (event.status !== 'canceled' || event.type !== 'previsto_recorrencia') {
      throw new Error('Somente ocorrencias canceladas podem voltar para previsao.');
    }

    const updated: PlanningEvent = {
      ...event,
      status: 'active',
      updatedAt: new Date().toISOString(),
    };

    await this.planningEventRepository.save(updated);
    return updated;
  }
}
