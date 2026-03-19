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
import { GetChartOfAccountsSetupUseCase } from '../application/use-cases/GetChartOfAccountsSetupUseCase';
import { CreateChartOfAccountsNodeUseCase } from '../application/use-cases/CreateChartOfAccountsNodeUseCase';
import { UpdateChartOfAccountsNodeUseCase } from '../application/use-cases/UpdateChartOfAccountsNodeUseCase';
import { RemoveOrArchiveChartOfAccountsNodeUseCase } from '../application/use-cases/RemoveOrArchiveChartOfAccountsNodeUseCase';
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
import { ReverseRecurrenceSettlementUseCase } from '../application/use-cases/ReverseRecurrenceSettlementUseCase';
import { SettleRecurrencePlanningEventUseCase } from '../application/use-cases/SettleRecurrencePlanningEventUseCase';
import { CancelRecurrencePlanningEventOccurrenceUseCase } from '../application/use-cases/CancelRecurrencePlanningEventOccurrenceUseCase';
import { RevertRecurrenceOccurrenceCancellationUseCase } from '../application/use-cases/RevertRecurrenceOccurrenceCancellationUseCase';
import { PostponePlanningEventSettlementUseCase } from '../application/use-cases/PostponePlanningEventSettlementUseCase';
import { VerifyPlanningEventUseCase } from '../application/use-cases/VerifyPlanningEventUseCase';
import { UnverifyPlanningEventUseCase } from '../application/use-cases/UnverifyPlanningEventUseCase';
import { GetAccountAvailabilityStatementUseCase } from '../application/use-cases/GetAccountAvailabilityStatementUseCase';
import { GetProjectionAvailabilitySummaryUseCase } from '../application/use-cases/GetProjectionAvailabilitySummaryUseCase';
import { CreateCounterpartyUseCase } from '../application/use-cases/CreateCounterpartyUseCase';
import { ListCounterpartiesUseCase } from '../application/use-cases/ListCounterpartiesUseCase';
import { SearchCounterpartiesByNameUseCase } from '../application/use-cases/SearchCounterpartiesByNameUseCase';
import { SearchCounterpartiesByDocumentUseCase } from '../application/use-cases/SearchCounterpartiesByDocumentUseCase';
import { CreateCommitmentUseCase } from '../application/use-cases/CreateCommitmentUseCase';
import { ListCommitmentsUseCase } from '../application/use-cases/ListCommitmentsUseCase';
import { SettleCommitmentUseCase } from '../application/use-cases/SettleCommitmentUseCase';
import { ReverseCommitmentSettlementUseCase } from '../application/use-cases/ReverseCommitmentSettlementUseCase';
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
    getChartOfAccountsSetup: GetChartOfAccountsSetupUseCase;
    createChartOfAccountsNode: CreateChartOfAccountsNodeUseCase;
    updateChartOfAccountsNode: UpdateChartOfAccountsNodeUseCase;
    removeOrArchiveChartOfAccountsNode: RemoveOrArchiveChartOfAccountsNodeUseCase;
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
    reverseRecurrenceSettlement: ReverseRecurrenceSettlementUseCase;
    settleRecurrencePlanningEvent: SettleRecurrencePlanningEventUseCase;
    postponePlanningEventSettlement: PostponePlanningEventSettlementUseCase;
    verifyPlanningEvent: VerifyPlanningEventUseCase;
    unverifyPlanningEvent: UnverifyPlanningEventUseCase;
    cancelRecurrencePlanningEventOccurrence: CancelRecurrencePlanningEventOccurrenceUseCase;
    revertRecurrenceOccurrenceCancellation: RevertRecurrenceOccurrenceCancellationUseCase;
    getAccountAvailabilityStatement: GetAccountAvailabilityStatementUseCase;
    getProjectionAvailabilitySummary: GetProjectionAvailabilitySummaryUseCase;
    createCounterparty: CreateCounterpartyUseCase;
    listCounterparties: ListCounterpartiesUseCase;
    searchCounterpartiesByName: SearchCounterpartiesByNameUseCase;
    searchCounterpartiesByDocument: SearchCounterpartiesByDocumentUseCase;
    createCommitment: CreateCommitmentUseCase;
    listCommitments: ListCommitmentsUseCase;
    settleCommitment: SettleCommitmentUseCase;
    reverseCommitmentSettlement: ReverseCommitmentSettlementUseCase;
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
    getChartOfAccountsSetup: new GetChartOfAccountsSetupUseCase(
      repositories.controlCenterRepository,
      repositories.ledgerAccountRepository,
      repositories.ledgerEntryRepository,
    ),
    createChartOfAccountsNode: new CreateChartOfAccountsNodeUseCase(
      repositories.ledgerAccountRepository,
    ),
    updateChartOfAccountsNode: new UpdateChartOfAccountsNodeUseCase(
      repositories.ledgerAccountRepository,
    ),
    removeOrArchiveChartOfAccountsNode: new RemoveOrArchiveChartOfAccountsNodeUseCase(
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
      repositories.ledgerAccountRepository,
      repositories.ledgerEntryRepository,
    ),
    reverseRecurrenceSettlement: new ReverseRecurrenceSettlementUseCase(
      repositories.planningEventRepository,
      repositories.ledgerAccountRepository,
      repositories.ledgerEntryRepository,
    ),
    settleRecurrencePlanningEvent: new SettleRecurrencePlanningEventUseCase(
      repositories.planningEventRepository,
      repositories.accountRepository,
      repositories.ledgerAccountRepository,
      repositories.ledgerEntryRepository,
    ),
    postponePlanningEventSettlement: new PostponePlanningEventSettlementUseCase(
      repositories.planningEventRepository,
    ),
    verifyPlanningEvent: new VerifyPlanningEventUseCase(repositories.planningEventRepository),
    unverifyPlanningEvent: new UnverifyPlanningEventUseCase(repositories.planningEventRepository),
    cancelRecurrencePlanningEventOccurrence: new CancelRecurrencePlanningEventOccurrenceUseCase(
      repositories.planningEventRepository,
      new ReverseRecurrenceConfirmationUseCase(
        repositories.planningEventRepository,
        repositories.ledgerAccountRepository,
        repositories.ledgerEntryRepository,
      ),
    ),
    revertRecurrenceOccurrenceCancellation: new RevertRecurrenceOccurrenceCancellationUseCase(
      repositories.planningEventRepository,
    ),
    getAccountAvailabilityStatement: new GetAccountAvailabilityStatementUseCase(
      repositories.accountRepository,
      repositories.ledgerEntryRepository,
    ),
    getProjectionAvailabilitySummary: new GetProjectionAvailabilitySummaryUseCase(
      repositories.accountRepository,
      repositories.ledgerEntryRepository,
      repositories.planningEventRepository,
    ),
    createCounterparty: new CreateCounterpartyUseCase(repositories.counterpartyRepository),
    listCounterparties: new ListCounterpartiesUseCase(repositories.counterpartyRepository),
    searchCounterpartiesByName: new SearchCounterpartiesByNameUseCase(
      repositories.counterpartyRepository,
    ),
    searchCounterpartiesByDocument: new SearchCounterpartiesByDocumentUseCase(
      repositories.counterpartyRepository,
    ),
    createCommitment: new CreateCommitmentUseCase(repositories.commitmentRepository),
    listCommitments: new ListCommitmentsUseCase(repositories.commitmentRepository),
    settleCommitment: new SettleCommitmentUseCase(repositories.commitmentRepository),
    reverseCommitmentSettlement: new ReverseCommitmentSettlementUseCase(
      repositories.commitmentRepository,
    ),
  };

  return {
    repositories,
    useCases,
  };
}
