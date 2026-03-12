import type { User } from '../../../domain/entities/User';
import type { UserRepository } from '../../../domain/repositories/UserRepository';
import type { ID } from '../../../domain/types/common';
import type { StorageDriver } from '../../storage/local-storage/driver';
import { STORAGE_KEYS } from '../../storage/local-storage/keys';

export class LocalStorageUserRepository implements UserRepository {
  constructor(private readonly storage: StorageDriver) {}

  async getById(id: ID): Promise<User | null> {
    const users = this.readAll();
    return users.find((user) => user.id === id) ?? null;
  }

  async getByEmail(email: string): Promise<User | null> {
    const users = this.readAll();
    return users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
  }

  async listAll(): Promise<User[]> {
    return this.readAll();
  }

  async save(user: User): Promise<void> {
    const users = this.readAll();
    const index = users.findIndex((current) => current.id === user.id);

    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }

    this.storage.setItem<User[]>(STORAGE_KEYS.users, users);
  }

  private readAll(): User[] {
    return this.storage.getItem<User[]>(STORAGE_KEYS.users) ?? [];
  }
}
