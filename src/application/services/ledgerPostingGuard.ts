import type { LedgerEntryLine } from '../../domain/entities/LedgerEntry';
import type { LedgerAccountRepository } from '../../domain/repositories/LedgerAccountRepository';
import type { ID } from '../../domain/types/common';

export async function assertPostingLedgerLines(input: {
  controlCenterId: ID;
  lines: LedgerEntryLine[];
  ledgerAccountRepository: LedgerAccountRepository;
}): Promise<void> {
  const uniqueAccountIds = Array.from(new Set(input.lines.map((line) => line.ledgerAccountId)));

  const accounts = await Promise.all(
    uniqueAccountIds.map(async (accountId) => input.ledgerAccountRepository.getById(accountId)),
  );

  for (let index = 0; index < accounts.length; index += 1) {
    const account = accounts[index];
    const accountId = uniqueAccountIds[index];

    if (!account || account.controlCenterId !== input.controlCenterId) {
      throw new Error(`Conta contabil invalida no lancamento (${accountId}).`);
    }

    if (account.accountRole !== 'posting') {
      throw new Error(
        `Conta contabil agrupadora nao pode receber lancamento (${account.code} - ${account.name}).`,
      );
    }
  }
}
