import type { PlanningEvent } from '../../domain/entities/PlanningEvent';
import type { PlanningEventRepository } from '../../domain/repositories/PlanningEventRepository';
import type { ID } from '../../domain/types/common';
import { CancelPlanningEventUseCase } from './CancelPlanningEventUseCase';
import { ReverseRecurrenceConfirmationUseCase } from './ReverseRecurrenceConfirmationUseCase';

interface CancelRecurrencePlanningEventOccurrenceInput {
  id: ID;
  controlCenterId: ID;
  canceledByUserId: ID;
}

export class CancelRecurrencePlanningEventOccurrenceUseCase {
  private readonly cancelPlanningEvent: CancelPlanningEventUseCase;
  private readonly reverseRecurrenceConfirmation: ReverseRecurrenceConfirmationUseCase;

  constructor(
    private readonly planningEventRepository: PlanningEventRepository,
    reverseRecurrenceConfirmation: ReverseRecurrenceConfirmationUseCase,
  ) {
    this.cancelPlanningEvent = new CancelPlanningEventUseCase(planningEventRepository);
    this.reverseRecurrenceConfirmation = reverseRecurrenceConfirmation;
  }

  async execute(input: CancelRecurrencePlanningEventOccurrenceInput): Promise<PlanningEvent> {
    const event = await this.planningEventRepository.getById(input.id);
    if (!event || event.controlCenterId !== input.controlCenterId) {
      throw new Error('Evento de recorrencia nao encontrado.');
    }

    if (event.sourceType !== 'recurrence') {
      throw new Error('Somente ocorrencias de recorrencia podem ser canceladas neste fluxo.');
    }

    if (event.status === 'canceled') {
      throw new Error('Ocorrencia ja esta cancelada.');
    }

    if (event.type === 'previsto_recorrencia' && event.status === 'active') {
      return this.cancelPlanningEvent.execute({
        id: event.id,
        controlCenterId: input.controlCenterId,
      });
    }

    if (event.type === 'confirmado_agendado' || event.type === 'realizado') {
      return this.reverseRecurrenceConfirmation.execute({
        id: event.id,
        controlCenterId: input.controlCenterId,
        reversedByUserId: input.canceledByUserId,
        targetState: 'canceled',
      });
    }

    throw new Error('Ocorrencia nao esta em estado cancelavel.');
  }
}
