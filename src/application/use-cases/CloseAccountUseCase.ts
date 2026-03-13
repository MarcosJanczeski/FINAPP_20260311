import type { Account } from '../../domain/entities/Account';
import type { AccountRepository } from '../../domain/repositories/AccountRepository';
import type { CloseAccountInputDTO } from '../dto/AccountSetupDTO';

export class CloseAccountUseCase {
  constructor(private readonly accountRepository: AccountRepository) {}

  async execute(input: CloseAccountInputDTO): Promise<Account> {
    const account = await this.accountRepository.getById(input.accountId);
    if (!account || account.controlCenterId !== input.controlCenterId) {
      throw new Error('Conta nao encontrada para este centro de controle.');
    }

    if (account.status === 'closed') {
      throw new Error('Conta ja esta encerrada.');
    }

    const now = new Date().toISOString();
    const updated: Account = {
      ...account,
      status: 'closed',
      closedAt: now,
      updatedAt: now,
    };

    await this.accountRepository.save(updated);
    return updated;
  }
}
