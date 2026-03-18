import type { LedgerAccount } from '../../domain/entities/LedgerAccount';
import type { LedgerAccountRepository } from '../../domain/repositories/LedgerAccountRepository';
import type { LedgerEntryRepository } from '../../domain/repositories/LedgerEntryRepository';
import type { ID } from '../../domain/types/common';

interface RemoveOrArchiveChartOfAccountsNodeInput {
  controlCenterId: ID;
  ledgerAccountId: ID;
}

export interface RemoveOrArchiveChartOfAccountsNodeResult {
  outcome: 'deleted' | 'archived';
  accountId: ID;
}

const ROOT_CODES = new Set(['ATIVO', 'PASSIVO', 'PATRIMONIO_LIQUIDO', 'RECEITAS', 'DESPESAS']);

export class RemoveOrArchiveChartOfAccountsNodeUseCase {
  constructor(
    private readonly ledgerAccountRepository: LedgerAccountRepository,
    private readonly ledgerEntryRepository: LedgerEntryRepository,
  ) {}

  async execute(
    input: RemoveOrArchiveChartOfAccountsNodeInput,
  ): Promise<RemoveOrArchiveChartOfAccountsNodeResult> {
    const account = await this.ledgerAccountRepository.getById(input.ledgerAccountId);
    if (!account || account.controlCenterId !== input.controlCenterId) {
      throw new Error('Conta contabil nao encontrada para este centro de controle.');
    }

    if (ROOT_CODES.has(account.code)) {
      throw new Error('Raiz obrigatoria nao pode ser removida neste fluxo.');
    }

    if (account.isSystem) {
      throw new Error('Conta de sistema nao pode ser removida neste fluxo.');
    }

    const [allAccounts, allEntries] = await Promise.all([
      this.ledgerAccountRepository.listByControlCenter(input.controlCenterId),
      this.ledgerEntryRepository.listByControlCenter(input.controlCenterId),
    ]);

    const hasChildren = allAccounts.some((candidate) => candidate.parentLedgerAccountId === account.id);
    if (hasChildren) {
      throw new Error('Conta com filhos nao pode ser removida ou inativada neste fluxo.');
    }

    const usageCount = allEntries.reduce((count, entry) => {
      const usedInEntry = entry.lines.some((line) => line.ledgerAccountId === account.id);
      return usedInEntry ? count + 1 : count;
    }, 0);

    if (usageCount > 0) {
      if (account.status !== 'inactive') {
        const archived: LedgerAccount = {
          ...account,
          status: 'inactive',
        };
        await this.ledgerAccountRepository.save(archived);
      }

      return {
        outcome: 'archived',
        accountId: account.id,
      };
    }

    await this.ledgerAccountRepository.delete(account.id);
    return {
      outcome: 'deleted',
      accountId: account.id,
    };
  }
}
