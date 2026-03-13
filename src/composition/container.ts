import { createLocalStorageRepositories } from '../infrastructure/repositories/local-storage';
import { createLocalStorageDriver } from '../infrastructure/storage/local-storage/driver';
import { GetCurrentSessionUseCase } from '../application/use-cases/GetCurrentSessionUseCase';
import { LoginUseCase } from '../application/use-cases/LoginUseCase';
import { LogoutUseCase } from '../application/use-cases/LogoutUseCase';
import { SignUpUseCase } from '../application/use-cases/SignUpUseCase';
import { CompleteWelcomeProfileUseCase } from '../application/use-cases/CompleteWelcomeProfileUseCase';
import { CreateOrUpdatePersonalControlCenterUseCase } from '../application/use-cases/CreateOrUpdatePersonalControlCenterUseCase';
import { GetWelcomeSetupUseCase } from '../application/use-cases/GetWelcomeSetupUseCase';
import { GetAccountsSetupUseCase } from '../application/use-cases/GetAccountsSetupUseCase';
import { CreateAccountWithOpeningBalanceUseCase } from '../application/use-cases/CreateAccountWithOpeningBalanceUseCase';
import { UpdateAccountProfileUseCase } from '../application/use-cases/UpdateAccountProfileUseCase';
import { AdjustAccountOpeningUseCase } from '../application/use-cases/AdjustAccountOpeningUseCase';
import { DeleteAccountUseCase } from '../application/use-cases/DeleteAccountUseCase';
import { CloseAccountUseCase } from '../application/use-cases/CloseAccountUseCase';

export interface AppContainer {
  repositories: ReturnType<typeof createLocalStorageRepositories>;
  useCases: {
    getCurrentSession: GetCurrentSessionUseCase;
    signUp: SignUpUseCase;
    login: LoginUseCase;
    logout: LogoutUseCase;
    getWelcomeSetup: GetWelcomeSetupUseCase;
    completeWelcomeProfile: CompleteWelcomeProfileUseCase;
    createOrUpdatePersonalControlCenter: CreateOrUpdatePersonalControlCenterUseCase;
    getAccountsSetup: GetAccountsSetupUseCase;
    createAccountWithOpeningBalance: CreateAccountWithOpeningBalanceUseCase;
    updateAccountProfile: UpdateAccountProfileUseCase;
    adjustAccountOpening: AdjustAccountOpeningUseCase;
    deleteAccount: DeleteAccountUseCase;
    closeAccount: CloseAccountUseCase;
  };
}

export function createAppContainer(): AppContainer {
  const storage = createLocalStorageDriver();
  const repositories = createLocalStorageRepositories(storage);
  const useCases = {
    getCurrentSession: new GetCurrentSessionUseCase(repositories.authRepository),
    signUp: new SignUpUseCase(repositories.userRepository, repositories.authRepository),
    login: new LoginUseCase(repositories.userRepository, repositories.authRepository),
    logout: new LogoutUseCase(repositories.authRepository),
    getWelcomeSetup: new GetWelcomeSetupUseCase(
      repositories.personRepository,
      repositories.controlCenterRepository,
    ),
    completeWelcomeProfile: new CompleteWelcomeProfileUseCase(repositories.personRepository),
    createOrUpdatePersonalControlCenter: new CreateOrUpdatePersonalControlCenterUseCase(
      repositories.controlCenterRepository,
      repositories.controlCenterMembershipRepository,
    ),
    getAccountsSetup: new GetAccountsSetupUseCase(
      repositories.controlCenterRepository,
      repositories.accountRepository,
      repositories.ledgerAccountRepository,
      repositories.ledgerEntryRepository,
    ),
    createAccountWithOpeningBalance: new CreateAccountWithOpeningBalanceUseCase(
      repositories.accountRepository,
      repositories.ledgerAccountRepository,
      repositories.ledgerEntryRepository,
    ),
    updateAccountProfile: new UpdateAccountProfileUseCase(repositories.accountRepository),
    adjustAccountOpening: new AdjustAccountOpeningUseCase(
      repositories.accountRepository,
      repositories.ledgerAccountRepository,
      repositories.ledgerEntryRepository,
    ),
    deleteAccount: new DeleteAccountUseCase(
      repositories.accountRepository,
      repositories.ledgerEntryRepository,
    ),
    closeAccount: new CloseAccountUseCase(repositories.accountRepository),
  };

  return {
    repositories,
    useCases,
  };
}
