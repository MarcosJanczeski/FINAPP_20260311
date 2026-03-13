import type { Account } from '../../domain/entities/Account';
import type { AccountRepository } from '../../domain/repositories/AccountRepository';
import type { UpdateAccountProfileInputDTO } from '../dto/AccountSetupDTO';

export class UpdateAccountProfileUseCase {
  constructor(private readonly accountRepository: AccountRepository) {}

  async execute(input: UpdateAccountProfileInputDTO): Promise<Account> {
    const account = await this.accountRepository.getById(input.accountId);
    if (!account || account.controlCenterId !== input.controlCenterId) {
      throw new Error('Conta nao encontrada para este centro de controle.');
    }

    const name = input.name.trim();
    if (!name) {
      throw new Error('Nome da conta e obrigatorio.');
    }

    const updated: Account = {
      ...account,
      name,
      type: input.type,
      updatedAt: new Date().toISOString(),
    };

    await this.accountRepository.save(updated);
    return updated;
  }
}
