import type { LedgerAccount } from '../../../domain/entities/LedgerAccount';
import type { LedgerEntry } from '../../../domain/entities/LedgerEntry';
import type { LedgerAccountRepository } from '../../../domain/repositories/LedgerAccountRepository';
import type { LedgerEntryRepository } from '../../../domain/repositories/LedgerEntryRepository';
import type { ID } from '../../../domain/types/common';
import type { StorageDriver } from '../../storage/local-storage/driver';
import { STORAGE_KEYS } from '../../storage/local-storage/keys';

export class LocalStorageLedgerAccountRepository implements LedgerAccountRepository {
  constructor(private readonly storage: StorageDriver) {}

  async getById(id: ID): Promise<LedgerAccount | null> {
    return this.readAccounts().find((account) => account.id === id) ?? null;
  }

  async getByCode(controlCenterId: ID, code: string): Promise<LedgerAccount | null> {
    return (
      this.readAccounts().find(
        (account) => account.controlCenterId === controlCenterId && account.code === code,
      ) ?? null
    );
  }

  async listByControlCenter(controlCenterId: ID): Promise<LedgerAccount[]> {
    return this.readAccounts().filter((account) => account.controlCenterId === controlCenterId);
  }

  async save(account: LedgerAccount): Promise<void> {
    const accounts = this.readAccounts();
    const index = accounts.findIndex((current) => current.id === account.id);

    if (index >= 0) {
      accounts[index] = account;
    } else {
      accounts.push(account);
    }

    this.storage.setItem<LedgerAccount[]>(STORAGE_KEYS.ledgerAccounts, accounts);
  }

  private readAccounts(): LedgerAccount[] {
    return this.storage.getItem<LedgerAccount[]>(STORAGE_KEYS.ledgerAccounts) ?? [];
  }
}

export class LocalStorageLedgerEntryRepository implements LedgerEntryRepository {
  constructor(private readonly storage: StorageDriver) {}

  async getById(id: ID): Promise<LedgerEntry | null> {
    return this.readEntries().find((entry) => entry.id === id) ?? null;
  }

  async listByControlCenter(controlCenterId: ID): Promise<LedgerEntry[]> {
    return this.readEntries().filter((entry) => entry.controlCenterId === controlCenterId);
  }

  async save(entry: LedgerEntry): Promise<void> {
    const entries = this.readEntries();
    const index = entries.findIndex((current) => current.id === entry.id);

    if (index >= 0) {
      entries[index] = entry;
    } else {
      entries.push(entry);
    }

    this.storage.setItem<LedgerEntry[]>(STORAGE_KEYS.ledgerEntries, entries);
  }

  private readEntries(): LedgerEntry[] {
    return this.storage.getItem<LedgerEntry[]>(STORAGE_KEYS.ledgerEntries) ?? [];
  }
}
