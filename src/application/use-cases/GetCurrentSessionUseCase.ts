import type { AuthRepository } from '../../domain/repositories/AuthRepository';
import type { AuthSessionDTO } from '../dto/AuthSessionDTO';

export class GetCurrentSessionUseCase {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(): Promise<AuthSessionDTO | null> {
    return this.authRepository.getCurrentSession();
  }
}
