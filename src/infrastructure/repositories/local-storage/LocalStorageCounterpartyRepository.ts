import type { Counterparty } from '../../../domain/entities/Counterparty';
import type { CounterpartyRepository } from '../../../domain/repositories/CounterpartyRepository';
import type { ID } from '../../../domain/types/common';
import { normalizeDocument } from '../../../shared/utils/normalizeDocument';
import type { StorageDriver } from '../../storage/local-storage/driver';
import { STORAGE_KEYS } from '../../storage/local-storage/keys';

export class LocalStorageCounterpartyRepository implements CounterpartyRepository {
  constructor(private readonly storage: StorageDriver) {}

  async getById(id: ID): Promise<Counterparty | null> {
    return this.readAll().find((counterparty) => counterparty.id === id) ?? null;
  }

  async listByControlCenter(controlCenterId: ID): Promise<Counterparty[]> {
    return this.readAll()
      .filter((counterparty) => counterparty.controlCenterId === controlCenterId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async searchByName(controlCenterId: ID, nameQuery: string): Promise<Counterparty[]> {
    const normalizedQuery = nameQuery.trim().toLocaleLowerCase();
    if (!normalizedQuery) {
      return [];
    }

    return this.readAll()
      .filter((counterparty) => counterparty.controlCenterId === controlCenterId)
      .filter((counterparty) => counterparty.name.toLocaleLowerCase().includes(normalizedQuery))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async findByNormalizedDocument(
    controlCenterId: ID,
    normalizedDocument: string,
  ): Promise<Counterparty[]> {
    const normalizedQuery = normalizeDocument(normalizedDocument);
    if (!normalizedQuery) {
      return [];
    }

    return this.readAll()
      .filter((counterparty) => counterparty.controlCenterId === controlCenterId)
      .filter((counterparty) => normalizeDocument(counterparty.document) === normalizedQuery)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async save(counterparty: Counterparty): Promise<void> {
    const counterparties = this.readAll();
    const index = counterparties.findIndex((current) => current.id === counterparty.id);

    if (index >= 0) {
      counterparties[index] = counterparty;
    } else {
      counterparties.push(counterparty);
    }

    this.storage.setItem<Counterparty[]>(STORAGE_KEYS.counterparties, counterparties);
  }

  async delete(id: ID): Promise<void> {
    const counterparties = this.readAll().filter((counterparty) => counterparty.id !== id);
    this.storage.setItem<Counterparty[]>(STORAGE_KEYS.counterparties, counterparties);
  }

  private readAll(): Counterparty[] {
    const counterparties = this.storage.getItem<Counterparty[]>(STORAGE_KEYS.counterparties) ?? [];

    return counterparties.map((counterparty) => ({
      ...counterparty,
      document: normalizeDocument(counterparty.document) || null,
      type: counterparty.type ?? null,
      email: counterparty.email ?? null,
      phone: counterparty.phone ?? null,
      notes: counterparty.notes ?? null,
      status: counterparty.status ?? 'active',
      updatedAt: counterparty.updatedAt ?? counterparty.createdAt,
    }));
  }
}
