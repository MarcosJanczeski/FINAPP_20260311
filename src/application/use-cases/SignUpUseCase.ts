import type { User } from '../../domain/entities/User';
import type { AuthRepository } from '../../domain/repositories/AuthRepository';
import type { UserRepository } from '../../domain/repositories/UserRepository';
import type { AuthCredentialsDTO } from '../dto/AuthCredentialsDTO';

export class SignUpUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly authRepository: AuthRepository,
  ) {}

  async execute(input: AuthCredentialsDTO): Promise<User> {
    const email = input.email.trim().toLowerCase();
    const password = input.password.trim();

    if (!email || !password) {
      throw new Error('Email e senha sao obrigatorios.');
    }

    const existingUser = await this.userRepository.getByEmail(email);
    if (existingUser) {
      throw new Error('Ja existe usuario com este email.');
    }

    const now = new Date().toISOString();
    const user: User = {
      id: crypto.randomUUID(),
      email,
      password,
      createdAt: now,
      updatedAt: now,
    };

    await this.userRepository.save(user);
    await this.authRepository.saveSession({ userId: user.id });

    return user;
  }
}
