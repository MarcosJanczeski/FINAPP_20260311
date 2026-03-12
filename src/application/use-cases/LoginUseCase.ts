import type { AuthRepository } from '../../domain/repositories/AuthRepository';
import type { UserRepository } from '../../domain/repositories/UserRepository';
import type { AuthCredentialsDTO } from '../dto/AuthCredentialsDTO';

export class LoginUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly authRepository: AuthRepository,
  ) {}

  async execute(input: AuthCredentialsDTO): Promise<void> {
    const email = input.email.trim().toLowerCase();
    const password = input.password.trim();

    if (!email || !password) {
      throw new Error('Email e senha sao obrigatorios.');
    }

    const user = await this.userRepository.getByEmail(email);
    if (!user || user.password !== password) {
      throw new Error('Credenciais invalidas.');
    }

    await this.authRepository.saveSession({ userId: user.id });
  }
}
