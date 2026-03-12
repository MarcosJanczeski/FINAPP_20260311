import { LocalStorageAuthRepository } from './LocalStorageAuthRepository';
import {
  LocalStorageControlCenterMembershipRepository,
  LocalStorageControlCenterRepository,
} from './LocalStorageControlCenterRepository';
import { LocalStorageUserRepository } from './LocalStorageUserRepository';
import type { StorageDriver } from '../../storage/local-storage/driver';

export function createLocalStorageRepositories(storage: StorageDriver) {
  const membershipRepository = new LocalStorageControlCenterMembershipRepository(storage);

  return {
    authRepository: new LocalStorageAuthRepository(storage),
    userRepository: new LocalStorageUserRepository(storage),
    controlCenterMembershipRepository: membershipRepository,
    controlCenterRepository: new LocalStorageControlCenterRepository(
      storage,
      membershipRepository,
    ),
  };
}
