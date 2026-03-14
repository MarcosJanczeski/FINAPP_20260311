import type { Recurrence } from '../../../domain/entities/Recurrence';
import type { RecurrenceRepository } from '../../../domain/repositories/RecurrenceRepository';
import type { ID } from '../../../domain/types/common';
import type { StorageDriver } from '../../storage/local-storage/driver';
import { STORAGE_KEYS } from '../../storage/local-storage/keys';

export class LocalStorageRecurrenceRepository implements RecurrenceRepository {
  constructor(private readonly storage: StorageDriver) {}

  async getById(id: ID): Promise<Recurrence | null> {
    return this.readAll().find((recurrence) => recurrence.id === id) ?? null;
  }

  async listByControlCenter(controlCenterId: ID): Promise<Recurrence[]> {
    return this.readAll()
      .filter((recurrence) => recurrence.controlCenterId === controlCenterId)
      .sort((a, b) => a.description.localeCompare(b.description));
  }

  async save(recurrence: Recurrence): Promise<void> {
    const recurrences = this.readAll();
    const index = recurrences.findIndex((current) => current.id === recurrence.id);

    if (index >= 0) {
      recurrences[index] = recurrence;
    } else {
      recurrences.push(recurrence);
    }

    this.storage.setItem<Recurrence[]>(STORAGE_KEYS.recurrences, recurrences);
  }

  private readAll(): Recurrence[] {
    const recurrences = this.storage.getItem<Recurrence[]>(STORAGE_KEYS.recurrences) ?? [];

    return recurrences.map((recurrence) => ({
      ...recurrence,
      frequency: recurrence.frequency ?? 'monthly',
      status: recurrence.status ?? 'active',
      updatedAt: recurrence.updatedAt ?? recurrence.createdAt,
    }));
  }
}
