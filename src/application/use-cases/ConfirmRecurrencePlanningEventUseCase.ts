import type { PlanningEvent } from '../../domain/entities/PlanningEvent';
import type { PlanningEventRepository } from '../../domain/repositories/PlanningEventRepository';
import type { ID, ISODateString } from '../../domain/types/common';

interface ConfirmRecurrencePlanningEventInput {
  id: ID;
  controlCenterId: ID;
  confirmedDate: ISODateString;
  confirmedAmountCents: number;
}

export class ConfirmRecurrencePlanningEventUseCase {
  constructor(private readonly planningEventRepository: PlanningEventRepository) {}

  async execute(input: ConfirmRecurrencePlanningEventInput): Promise<PlanningEvent> {
    if (input.confirmedAmountCents < 0) {
      throw new Error('Valor confirmado deve ser maior ou igual a zero.');
    }

    const event = await this.planningEventRepository.getById(input.id);
    if (!event || event.controlCenterId !== input.controlCenterId) {
      throw new Error('Evento de recorrencia nao encontrado.');
    }

    if (event.type !== 'previsto_recorrencia') {
      throw new Error('Somente recorrencia prevista pode ser confirmada neste fluxo.');
    }

    if (event.status !== 'active') {
      throw new Error('Somente recorrencia prevista ativa pode ser confirmada.');
    }

    const updated: PlanningEvent = {
      ...event,
      type: 'confirmado_agendado',
      status: 'confirmed',
      date: input.confirmedDate,
      amountCents: input.confirmedAmountCents,
      updatedAt: new Date().toISOString(),
    };

    await this.planningEventRepository.save(updated);
    return updated;
  }
}
