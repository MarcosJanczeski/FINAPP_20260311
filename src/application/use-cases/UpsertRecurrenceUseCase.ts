import type { Recurrence, RecurrenceStatus } from '../../domain/entities/Recurrence';
import type { PlanningEventDirection } from '../../domain/entities/PlanningEvent';
import type { RecurrenceRepository } from '../../domain/repositories/RecurrenceRepository';
import type { ID } from '../../domain/types/common';

interface UpsertRecurrenceInput {
  id?: ID;
  controlCenterId: ID;
  description: string;
  dayOfMonth: number;
  direction: PlanningEventDirection;
  amountCents: number;
  status?: RecurrenceStatus;
}

export class UpsertRecurrenceUseCase {
  constructor(private readonly recurrenceRepository: RecurrenceRepository) {}

  async execute(input: UpsertRecurrenceInput): Promise<Recurrence> {
    const dayOfMonth = Math.trunc(input.dayOfMonth);
    if (dayOfMonth < 1 || dayOfMonth > 31) {
      throw new Error('Dia da recorrencia deve estar entre 1 e 31.');
    }

    if (input.amountCents < 0) {
      throw new Error('Valor da recorrencia deve ser maior ou igual a zero.');
    }

    const description = input.description.trim();
    if (!description) {
      throw new Error('Descricao da recorrencia e obrigatoria.');
    }

    const existing = input.id ? await this.recurrenceRepository.getById(input.id) : null;
    const now = new Date().toISOString();

    const recurrence: Recurrence = {
      id: existing?.id ?? crypto.randomUUID(),
      controlCenterId: input.controlCenterId,
      description,
      frequency: 'monthly',
      dayOfMonth,
      direction: input.direction,
      amountCents: input.amountCents,
      status: input.status ?? existing?.status ?? 'active',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await this.recurrenceRepository.save(recurrence);
    return recurrence;
  }
}
