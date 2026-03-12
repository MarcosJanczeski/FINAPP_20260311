import { createLocalStorageRepositories } from '../infrastructure/repositories/local-storage';
import { createLocalStorageDriver } from '../infrastructure/storage/local-storage/driver';
import { GetCurrentSessionUseCase } from '../application/use-cases/GetCurrentSessionUseCase';
import { LoginUseCase } from '../application/use-cases/LoginUseCase';
import { LogoutUseCase } from '../application/use-cases/LogoutUseCase';
import { SignUpUseCase } from '../application/use-cases/SignUpUseCase';
import { CompleteWelcomeProfileUseCase } from '../application/use-cases/CompleteWelcomeProfileUseCase';
import { CreateOrUpdatePersonalControlCenterUseCase } from '../application/use-cases/CreateOrUpdatePersonalControlCenterUseCase';
import { GetWelcomeSetupUseCase } from '../application/use-cases/GetWelcomeSetupUseCase';

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
  };

  return {
    repositories,
    useCases,
  };
}
