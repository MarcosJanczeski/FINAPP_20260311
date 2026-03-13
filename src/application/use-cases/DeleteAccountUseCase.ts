import type { AccountRepository } from '../../domain/repositories/AccountRepository';
import type { LedgerEntryRepository } from '../../domain/repositories/LedgerEntryRepository';
import type { DeleteAccountInputDTO } from '../dto/AccountSetupDTO';

export class DeleteAccountUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly ledgerEntryRepository: LedgerEntryRepository,
  ) {}

  async execute(input: DeleteAccountInputDTO): Promise<void> {
    const account = await this.accountRepository.getById(input.accountId);

    if (!account || account.controlCenterId !== input.controlCenterId) {
      throw new Error('Conta nao encontrada para este centro de controle.');
    }

    const entries = await this.ledgerEntryRepository.listByControlCenter(input.controlCenterId);
    const hasLinkedEntries = entries.some((entry) => entry.referenceId === account.id);

    if (hasLinkedEntries) {
      throw new Error(
        'Nao e possivel excluir conta com lancamentos contabeis vinculados. Use ajuste ou encerramento.',
      );
    }

    await this.accountRepository.delete(account.id);
  }
}
