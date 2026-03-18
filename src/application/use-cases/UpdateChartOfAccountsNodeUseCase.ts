import type { LedgerAccount } from '../../domain/entities/LedgerAccount';
import type { LedgerAccountRepository } from '../../domain/repositories/LedgerAccountRepository';
import type { ID } from '../../domain/types/common';

interface UpdateChartOfAccountsNodeInput {
  controlCenterId: ID;
  ledgerAccountId: ID;
  name: string;
  status: 'active' | 'inactive';
}

const ROOT_CODES = new Set(['ATIVO', 'PASSIVO', 'PATRIMONIO_LIQUIDO', 'RECEITAS', 'DESPESAS']);

export class UpdateChartOfAccountsNodeUseCase {
  constructor(private readonly ledgerAccountRepository: LedgerAccountRepository) {}

  async execute(input: UpdateChartOfAccountsNodeInput): Promise<LedgerAccount> {
    const account = await this.ledgerAccountRepository.getById(input.ledgerAccountId);
    if (!account || account.controlCenterId !== input.controlCenterId) {
      throw new Error('Conta contabil nao encontrada para este centro de controle.');
    }

    const isRoot = ROOT_CODES.has(account.code);
    if (isRoot) {
      throw new Error('Raiz obrigatoria nao pode ser editada neste fluxo.');
    }

    if (account.isSystem) {
      throw new Error('Conta de sistema nao pode ser editada neste fluxo.');
    }

    const name = input.name.trim();
    if (!name) {
      throw new Error('Nome da conta e obrigatorio.');
    }

    const updated: LedgerAccount = {
      ...account,
      name,
      status: input.status,
    };

    await this.ledgerAccountRepository.save(updated);
    return updated;
  }
}
