import type { PlanningEvent } from '../../domain/entities/PlanningEvent';
import type { PlanningEventRepository } from '../../domain/repositories/PlanningEventRepository';
import type { ID } from '../../domain/types/common';
import type { PlanningEventSourceProvider } from '../services/PlanningEventSourceProvider';

interface SyncPlanningEventsInput {
  controlCenterId: ID;
}

export class SyncPlanningEventsUseCase {
  constructor(
    private readonly planningEventRepository: PlanningEventRepository,
    private readonly sourceProviders: PlanningEventSourceProvider[],
  ) {}

  async execute(input: SyncPlanningEventsInput): Promise<PlanningEvent[]> {
    const existing = await this.planningEventRepository.listByControlCenter(input.controlCenterId);
    const sourceItems = (
      await Promise.all(this.sourceProviders.map((provider) => provider.list(input.controlCenterId)))
    ).flat();

    const now = new Date().toISOString();
    const existingAutoByKey = new Map(
      existing
        .filter((event) => event.sourceType !== 'manual' && event.sourceEventKey)
        .map((event) => [event.sourceEventKey as string, event]),
    );
    const seenKeys = new Set<string>();

    for (const sourceItem of sourceItems) {
      seenKeys.add(sourceItem.sourceEventKey);
      const current = existingAutoByKey.get(sourceItem.sourceEventKey);
      const preserved = current && current.status !== 'active' ? current : null;

      const next: PlanningEvent = {
        id: current?.id ?? crypto.randomUUID(),
        controlCenterId: input.controlCenterId,
        date: preserved?.date ?? sourceItem.date,
        description: preserved?.description ?? sourceItem.description,
        type: preserved?.type ?? sourceItem.type,
        status: preserved?.status ?? sourceItem.status,
        direction: preserved?.direction ?? sourceItem.direction,
        amountCents: preserved?.amountCents ?? sourceItem.amountCents,
        sourceType: sourceItem.sourceType,
        sourceId: sourceItem.sourceId,
        sourceEventKey: sourceItem.sourceEventKey,
        ledgerLinks: current?.ledgerLinks ?? [],
        postedLedgerEntryId: current?.postedLedgerEntryId ?? null,
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
      };

      await this.planningEventRepository.save(next);
    }

    const staleAutoEvents = existing.filter(
      (event) =>
        event.sourceType !== 'manual' &&
        event.sourceEventKey &&
        !seenKeys.has(event.sourceEventKey) &&
        (event.status === 'active' || event.status === 'confirmed'),
    );

    for (const stale of staleAutoEvents) {
      await this.planningEventRepository.save({
        ...stale,
        status: 'canceled',
        updatedAt: now,
      });
    }

    return this.planningEventRepository.listByControlCenter(input.controlCenterId);
  }
}
