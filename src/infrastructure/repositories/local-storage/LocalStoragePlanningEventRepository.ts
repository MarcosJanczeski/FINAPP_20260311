import type { PlanningEvent } from '../../../domain/entities/PlanningEvent';
import type { PlanningEventRepository } from '../../../domain/repositories/PlanningEventRepository';
import type { ID } from '../../../domain/types/common';
import type { StorageDriver } from '../../storage/local-storage/driver';
import { STORAGE_KEYS } from '../../storage/local-storage/keys';

export class LocalStoragePlanningEventRepository implements PlanningEventRepository {
  constructor(private readonly storage: StorageDriver) {}

  async getById(id: ID): Promise<PlanningEvent | null> {
    return this.readAll().find((event) => event.id === id) ?? null;
  }

  async listByControlCenter(controlCenterId: ID): Promise<PlanningEvent[]> {
    return this.readAll()
      .filter((event) => event.controlCenterId === controlCenterId)
      .sort((a, b) => (a.date > b.date ? 1 : -1));
  }

  async save(event: PlanningEvent): Promise<void> {
    const events = this.readAll();
    const index = events.findIndex((current) => current.id === event.id);

    if (index >= 0) {
      events[index] = event;
    } else {
      events.push(event);
    }

    this.storage.setItem<PlanningEvent[]>(STORAGE_KEYS.planningEvents, events);
  }

  private readAll(): PlanningEvent[] {
    const events = this.storage.getItem<PlanningEvent[]>(STORAGE_KEYS.planningEvents) ?? [];

    return events.map((event) => ({
      ...event,
      sourceId: event.sourceId ?? null,
      postedLedgerEntryId: event.postedLedgerEntryId ?? null,
      updatedAt: event.updatedAt ?? event.createdAt,
      status: event.status ?? 'active',
    }));
  }
}
