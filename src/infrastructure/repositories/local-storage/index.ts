import { LocalStorageAuthRepository } from './LocalStorageAuthRepository';
import {
  LocalStorageControlCenterMembershipRepository,
  LocalStorageControlCenterRepository,
} from './LocalStorageControlCenterRepository';
import { LocalStorageAccountRepository } from './LocalStorageAccountRepository';
import {
  LocalStorageLedgerAccountRepository,
  LocalStorageLedgerEntryRepository,
} from './LocalStorageLedgerRepository';
import { LocalStoragePersonRepository } from './LocalStoragePersonRepository';
import { LocalStorageUserRepository } from './LocalStorageUserRepository';
import { LocalStoragePlanningEventRepository } from './LocalStoragePlanningEventRepository';
import { LocalStorageRecurrenceRepository } from './LocalStorageRecurrenceRepository';
import { LocalStorageCounterpartyRepository } from './LocalStorageCounterpartyRepository';
import type { StorageDriver } from '../../storage/local-storage/driver';

export function createLocalStorageRepositories(storage: StorageDriver) {
  const membershipRepository = new LocalStorageControlCenterMembershipRepository(storage);

  return {
    authRepository: new LocalStorageAuthRepository(storage),
    userRepository: new LocalStorageUserRepository(storage),
    personRepository: new LocalStoragePersonRepository(storage),
    counterpartyRepository: new LocalStorageCounterpartyRepository(storage),
    accountRepository: new LocalStorageAccountRepository(storage),
    recurrenceRepository: new LocalStorageRecurrenceRepository(storage),
    planningEventRepository: new LocalStoragePlanningEventRepository(storage),
    ledgerAccountRepository: new LocalStorageLedgerAccountRepository(storage),
    ledgerEntryRepository: new LocalStorageLedgerEntryRepository(storage),
    controlCenterMembershipRepository: membershipRepository,
    controlCenterRepository: new LocalStorageControlCenterRepository(
      storage,
      membershipRepository,
    ),
  };
}
