import { createLocalStorageRepositories } from '../infrastructure/repositories/local-storage';
import { createLocalStorageDriver } from '../infrastructure/storage/local-storage/driver';

export interface AppContainer {
  repositories: ReturnType<typeof createLocalStorageRepositories>;
}

export function createAppContainer(): AppContainer {
  const storage = createLocalStorageDriver();
  const repositories = createLocalStorageRepositories(storage);

  return {
    repositories,
  };
}
