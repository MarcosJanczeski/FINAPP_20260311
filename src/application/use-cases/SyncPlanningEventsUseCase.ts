import type { PlanningEvent } from '../../domain/entities/PlanningEvent';
import type { PlanningEventRepository } from '../../domain/repositories/PlanningEventRepository';
import type { ID } from '../../domain/types/common';
import type { PlanningEventSourceProvider } from '../services/PlanningEventSourceProvider';
import { resolvePlanningEventOperationalSnapshot } from '../services/planningEventOperationalResolver';

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
    const uniqueSourceItems = Array.from(
      new Map(sourceItems.map((item) => [item.sourceEventKey, item])).values(),
    );

    const now = new Date().toISOString();
    const existingAutoEvents = existing.filter(
      (event) => event.sourceType !== 'manual' && event.sourceEventKey,
    );
    const groupedExistingByKey = new Map<string, PlanningEvent[]>();
    for (const event of existingAutoEvents) {
      const key = event.sourceEventKey as string;
      const current = groupedExistingByKey.get(key) ?? [];
      current.push(event);
      groupedExistingByKey.set(key, current);
    }
    const existingAutoByKey = new Map<string, PlanningEvent>();

    for (const [key, grouped] of groupedExistingByKey) {
      const sorted = [...grouped].sort((a, b) => {
        const rankA = this.rankForSyncKeeper(a);
        const rankB = this.rankForSyncKeeper(b);
        if (rankA !== rankB) {
          return rankA - rankB;
        }
        return a.updatedAt > b.updatedAt ? -1 : 1;
      });
      const keeper = sorted[0];
      existingAutoByKey.set(key, keeper);

      const duplicates = sorted.slice(1).filter((event) => event.status !== 'canceled');
      for (const duplicate of duplicates) {
        await this.planningEventRepository.save({
          ...duplicate,
          status: 'canceled',
          updatedAt: now,
        });
      }
    }

    const seenKeys = new Set<string>();

    for (const sourceItem of uniqueSourceItems) {
      seenKeys.add(sourceItem.sourceEventKey);
      const current = existingAutoByKey.get(sourceItem.sourceEventKey);
      const currentSnapshot = current ? resolvePlanningEventOperationalSnapshot(current) : null;
      const hasSettlement = (currentSnapshot?.activeLinksCount.settlement ?? 0) > 0;
      const preserved =
        current &&
        (currentSnapshot?.state === 'confirmado' ||
          currentSnapshot?.state === 'realizado' ||
          currentSnapshot?.state === 'cancelado' ||
          hasSettlement)
          ? current
          : null;
      const preservedSnapshot = preserved
        ? resolvePlanningEventOperationalSnapshot(preserved)
        : null;
      const normalizedType =
        (preservedSnapshot?.activeLinksCount.settlement ?? 0) > 0
          ? 'realizado'
          : preserved?.type;
      const normalizedStatus =
        (preservedSnapshot?.activeLinksCount.settlement ?? 0) > 0
          ? 'posted'
          : preserved?.status;

      const next: PlanningEvent = {
        id: current?.id ?? crypto.randomUUID(),
        controlCenterId: input.controlCenterId,
        date: preserved?.date ?? sourceItem.dueDate,
        documentDate: preserved?.documentDate ?? sourceItem.documentDate,
        dueDate: preserved?.dueDate ?? sourceItem.dueDate,
        plannedSettlementDate:
          preserved?.plannedSettlementDate ?? sourceItem.plannedSettlementDate,
        description: preserved?.description ?? sourceItem.description,
        type: normalizedType ?? sourceItem.type,
        status: normalizedStatus ?? sourceItem.status,
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
        event.status === 'active',
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

  private rankForSyncKeeper(event: PlanningEvent): number {
    const snapshot = resolvePlanningEventOperationalSnapshot(event);
    if (snapshot.activeLinksCount.settlement > 0) {
      return 0;
    }
    if (snapshot.state === 'confirmado') {
      return 1;
    }
    if (snapshot.state === 'realizado') {
      return 2;
    }
    if (snapshot.state === 'cancelado') {
      return 3;
    }
    if (snapshot.state === 'previsto') {
      return 4;
    }
    return 5;
  }
}
