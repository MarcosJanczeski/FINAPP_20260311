import type { Account } from '../../domain/entities/Account';
import type { AccountRepository } from '../../domain/repositories/AccountRepository';
import type { LedgerEntryRepository } from '../../domain/repositories/LedgerEntryRepository';
import type { ID, ISODateString } from '../../domain/types/common';
import { listAccountLedgerMovements } from '../services/accountAvailabilityLedger';

export interface AccountAvailabilityStatementLine {
  ledgerEntryId: ID;
  date: ISODateString;
  description: string;
  referenceType: string;
  referenceId: ID;
  debitCents: number;
  creditCents: number;
  movementCents: number;
  runningBalanceCents: number;
  createdAt: ISODateString;
}

export interface AccountAvailabilityStatementDTO {
  account: Pick<Account, 'id' | 'name' | 'nature' | 'status' | 'ledgerAccountId'>;
  basis: 'ledger_entries';
  lines: AccountAvailabilityStatementLine[];
}

interface GetAccountAvailabilityStatementInput {
  controlCenterId: ID;
  accountId: ID;
}

export class GetAccountAvailabilityStatementUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly ledgerEntryRepository: LedgerEntryRepository,
  ) {}

  async execute(
    input: GetAccountAvailabilityStatementInput,
  ): Promise<AccountAvailabilityStatementDTO> {
    const account = await this.accountRepository.getById(input.accountId);
    if (!account || account.controlCenterId !== input.controlCenterId) {
      throw new Error('Conta não encontrada para consulta de extrato.');
    }

    const entries = await this.ledgerEntryRepository.listByControlCenter(input.controlCenterId);
    const lines = listAccountLedgerMovements(entries, account.ledgerAccountId);

    let runningBalanceCents = 0;
    const linesWithBalance: AccountAvailabilityStatementLine[] = lines.map((line) => {
      runningBalanceCents += line.movementCents;
      return {
        ...line,
        runningBalanceCents,
      };
    });

    return {
      account: {
        id: account.id,
        name: account.name,
        nature: account.nature,
        status: account.status,
        ledgerAccountId: account.ledgerAccountId,
      },
      basis: 'ledger_entries',
      lines: linesWithBalance,
    };
  }
}
