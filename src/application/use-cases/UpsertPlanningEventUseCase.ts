import type {
  PlanningEvent,
  PlanningEventDirection,
  PlanningEventStatus,
  PlanningEventType,
} from '../../domain/entities/PlanningEvent';
import type { PlanningEventRepository } from '../../domain/repositories/PlanningEventRepository';
import type { ID, ISODateString } from '../../domain/types/common';

interface UpsertPlanningEventInput {
  id?: ID;
  controlCenterId: ID;
  date: ISODateString;
  description: string;
  type: PlanningEventType;
  status?: PlanningEventStatus;
  direction: PlanningEventDirection;
  amountCents: number;
  sourceType: PlanningEvent['sourceType'];
  sourceId?: ID | null;
}

export class UpsertPlanningEventUseCase {
  constructor(private readonly planningEventRepository: PlanningEventRepository) {}

  async execute(input: UpsertPlanningEventInput): Promise<PlanningEvent> {
    if (input.amountCents < 0) {
      throw new Error('Valor do evento deve ser maior ou igual a zero.');
    }

    const existing = input.id ? await this.planningEventRepository.getById(input.id) : null;
    const now = new Date().toISOString();

    const event: PlanningEvent = {
      id: existing?.id ?? crypto.randomUUID(),
      controlCenterId: input.controlCenterId,
      date: input.date,
      description: input.description.trim(),
      type: input.type,
      status: input.status ?? existing?.status ?? 'active',
      direction: input.direction,
      amountCents: input.amountCents,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      postedLedgerEntryId: existing?.postedLedgerEntryId ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await this.planningEventRepository.save(event);
    return event;
  }
}
