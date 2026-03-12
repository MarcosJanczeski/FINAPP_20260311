import type { AuthRepository, AuthSession } from '../../../domain/repositories/AuthRepository';
import type { StorageDriver } from '../../storage/local-storage/driver';
import { STORAGE_KEYS } from '../../storage/local-storage/keys';

export class LocalStorageAuthRepository implements AuthRepository {
  constructor(private readonly storage: StorageDriver) {}

  async getCurrentSession(): Promise<AuthSession | null> {
    return this.storage.getItem<AuthSession>(STORAGE_KEYS.authSession);
  }

  async saveSession(session: AuthSession): Promise<void> {
    this.storage.setItem<AuthSession>(STORAGE_KEYS.authSession, session);
  }

  async clearSession(): Promise<void> {
    this.storage.removeItem(STORAGE_KEYS.authSession);
  }
}
