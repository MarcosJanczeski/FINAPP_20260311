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
import { ListPlanningEventsUseCase } from '../application/use-cases/ListPlanningEventsUseCase';
import { UpsertPlanningEventUseCase } from '../application/use-cases/UpsertPlanningEventUseCase';
import { ConfirmPlanningEventUseCase } from '../application/use-cases/ConfirmPlanningEventUseCase';
import { CancelPlanningEventUseCase } from '../application/use-cases/CancelPlanningEventUseCase';
import { PostPlanningEventUseCase } from '../application/use-cases/PostPlanningEventUseCase';
import { SyncPlanningEventsUseCase } from '../application/use-cases/SyncPlanningEventsUseCase';
import { ListRecurrencesUseCase } from '../application/use-cases/ListRecurrencesUseCase';
import { UpsertRecurrenceUseCase } from '../application/use-cases/UpsertRecurrenceUseCase';
import { ConfirmRecurrencePlanningEventUseCase } from '../application/use-cases/ConfirmRecurrencePlanningEventUseCase';
import { ReverseRecurrenceConfirmationUseCase } from '../application/use-cases/ReverseRecurrenceConfirmationUseCase';
import { GetProjectionAvailabilitySummaryUseCase } from '../application/use-cases/GetProjectionAvailabilitySummaryUseCase';
import {
  NoopBudgetMarginPlanningEventSourceProvider,
} from '../application/services/NoopPlanningEventSourceProviders';
import { RecurrencePlanningEventSourceProvider } from '../application/services/RecurrencePlanningEventSourceProvider';

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
    listPlanningEvents: ListPlanningEventsUseCase;
    upsertPlanningEvent: UpsertPlanningEventUseCase;
    confirmPlanningEvent: ConfirmPlanningEventUseCase;
    cancelPlanningEvent: CancelPlanningEventUseCase;
    postPlanningEvent: PostPlanningEventUseCase;
    syncPlanningEvents: SyncPlanningEventsUseCase;
    listRecurrences: ListRecurrencesUseCase;
    upsertRecurrence: UpsertRecurrenceUseCase;
    confirmRecurrencePlanningEvent: ConfirmRecurrencePlanningEventUseCase;
    reverseRecurrenceConfirmation: ReverseRecurrenceConfirmationUseCase;
    getProjectionAvailabilitySummary: GetProjectionAvailabilitySummaryUseCase;
  };
}

export function createAppContainer(): AppContainer {
  const storage = createLocalStorageDriver();
  const repositories = createLocalStorageRepositories(storage);
  const planningSources = [
    new RecurrencePlanningEventSourceProvider(repositories.recurrenceRepository),
    new NoopBudgetMarginPlanningEventSourceProvider(),
  ];
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
    listPlanningEvents: new ListPlanningEventsUseCase(repositories.planningEventRepository),
    upsertPlanningEvent: new UpsertPlanningEventUseCase(repositories.planningEventRepository),
    confirmPlanningEvent: new ConfirmPlanningEventUseCase(repositories.planningEventRepository),
    cancelPlanningEvent: new CancelPlanningEventUseCase(repositories.planningEventRepository),
    postPlanningEvent: new PostPlanningEventUseCase(repositories.planningEventRepository),
    syncPlanningEvents: new SyncPlanningEventsUseCase(
      repositories.planningEventRepository,
      planningSources,
    ),
    listRecurrences: new ListRecurrencesUseCase(repositories.recurrenceRepository),
    upsertRecurrence: new UpsertRecurrenceUseCase(repositories.recurrenceRepository),
    confirmRecurrencePlanningEvent: new ConfirmRecurrencePlanningEventUseCase(
      repositories.planningEventRepository,
      repositories.ledgerAccountRepository,
      repositories.ledgerEntryRepository,
    ),
    reverseRecurrenceConfirmation: new ReverseRecurrenceConfirmationUseCase(
      repositories.planningEventRepository,
      repositories.ledgerEntryRepository,
    ),
    getProjectionAvailabilitySummary: new GetProjectionAvailabilitySummaryUseCase(
      repositories.accountRepository,
      repositories.planningEventRepository,
    ),
  };

  return {
    repositories,
    useCases,
  };
}
