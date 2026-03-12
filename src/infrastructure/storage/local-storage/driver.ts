import { FINAPP_STORAGE_NAMESPACE } from '../../../shared/constants/storage';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  readonly length: number;
}

export interface StorageDriver {
  getItem<T>(key: string): T | null;
  setItem<T>(key: string, value: T): void;
  removeItem(key: string): void;
  clearNamespace(): void;
}

export class LocalStorageDriver implements StorageDriver {
  constructor(
    private readonly storage: StorageLike,
    private readonly namespace = FINAPP_STORAGE_NAMESPACE,
  ) {}

  getItem<T>(key: string): T | null {
    const raw = this.storage.getItem(this.scopedKey(key));
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  setItem<T>(key: string, value: T): void {
    this.storage.setItem(this.scopedKey(key), JSON.stringify(value));
  }

  removeItem(key: string): void {
    this.storage.removeItem(this.scopedKey(key));
  }

  clearNamespace(): void {
    const keysToRemove: string[] = [];

    for (let index = 0; index < this.storage.length; index += 1) {
      const currentKey = this.storage.key(index);
      if (currentKey?.startsWith(`${this.namespace}.`)) {
        keysToRemove.push(currentKey);
      }
    }

    keysToRemove.forEach((key) => this.storage.removeItem(key));
  }

  private scopedKey(key: string): string {
    return `${this.namespace}.${key}`;
  }
}

export function createLocalStorageDriver(): StorageDriver {
  if (typeof window === 'undefined' || !window.localStorage) {
    throw new Error('window.localStorage is not available in this environment');
  }

  return new LocalStorageDriver(window.localStorage);
}
