import type { Account } from '../../../domain/entities/Account';
import type { AccountRepository } from '../../../domain/repositories/AccountRepository';
import type { ID } from '../../../domain/types/common';
import type { StorageDriver } from '../../storage/local-storage/driver';
import { STORAGE_KEYS } from '../../storage/local-storage/keys';

export class LocalStorageAccountRepository implements AccountRepository {
  constructor(private readonly storage: StorageDriver) {}

  async getById(id: ID): Promise<Account | null> {
    return this.readAll().find((account) => account.id === id) ?? null;
  }

  async listByControlCenter(controlCenterId: ID): Promise<Account[]> {
    return this.readAll().filter((account) => account.controlCenterId === controlCenterId);
  }

  async save(account: Account): Promise<void> {
    const accounts = this.readAll();
    const index = accounts.findIndex((current) => current.id === account.id);

    if (index >= 0) {
      accounts[index] = account;
    } else {
      accounts.push(account);
    }

    this.storage.setItem<Account[]>(STORAGE_KEYS.accounts, accounts);
  }

  async delete(id: ID): Promise<void> {
    const accounts = this.readAll().filter((account) => account.id !== id);
    this.storage.setItem<Account[]>(STORAGE_KEYS.accounts, accounts);
  }

  private readAll(): Account[] {
    const accounts = this.storage.getItem<Account[]>(STORAGE_KEYS.accounts) ?? [];

    return accounts.map((account) => ({
      ...account,
      status: account.status ?? 'active',
      closedAt: account.closedAt ?? null,
      updatedAt: account.updatedAt ?? account.createdAt,
    }));
  }
}
