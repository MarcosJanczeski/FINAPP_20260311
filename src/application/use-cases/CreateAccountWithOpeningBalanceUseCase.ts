import type { Account } from '../../domain/entities/Account';
import type { LedgerEntry } from '../../domain/entities/LedgerEntry';
import type { AccountRepository } from '../../domain/repositories/AccountRepository';
import type { LedgerAccountRepository } from '../../domain/repositories/LedgerAccountRepository';
import type { LedgerEntryRepository } from '../../domain/repositories/LedgerEntryRepository';
import type { CreateAccountInputDTO } from '../dto/AccountSetupDTO';

const OPENING_EQUITY_CODE = 'PL:SALDOS_INICIAIS';

export class CreateAccountWithOpeningBalanceUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly ledgerAccountRepository: LedgerAccountRepository,
    private readonly ledgerEntryRepository: LedgerEntryRepository,
  ) {}

  async execute(input: CreateAccountInputDTO): Promise<Account> {
    const name = input.name.trim();
    const openingBalanceCents = Math.trunc(input.openingBalanceCents);

    if (!name) {
      throw new Error('Nome da conta e obrigatorio.');
    }

    if (openingBalanceCents < 0) {
      throw new Error('Saldo inicial nao pode ser negativo.');
    }

    const ledgerAccount = await this.ledgerAccountRepository.getById(input.ledgerAccountId);
    if (!ledgerAccount || ledgerAccount.controlCenterId !== input.controlCenterId) {
      throw new Error('Conta contabil invalida para este centro de controle.');
    }

    if (
      (input.nature === 'asset' && ledgerAccount.kind !== 'asset') ||
      (input.nature === 'liability' && ledgerAccount.kind !== 'liability')
    ) {
      throw new Error('A natureza da conta nao corresponde a conta contabil selecionada.');
    }

    const openingEquity = await this.ensureOpeningEquityAccount(input.controlCenterId);

    const account: Account = {
      id: crypto.randomUUID(),
      controlCenterId: input.controlCenterId,
      name,
      type: input.type,
      nature: input.nature,
      ledgerAccountId: input.ledgerAccountId,
      openingBalanceCents,
      createdAt: new Date().toISOString(),
    };

    await this.accountRepository.save(account);

    if (openingBalanceCents > 0) {
      const entry = this.buildOpeningEntry(
        account,
        input.ledgerAccountId,
        openingEquity.id,
        openingBalanceCents,
      );
      await this.ledgerEntryRepository.save(entry);
    }

    return account;
  }

  private async ensureOpeningEquityAccount(controlCenterId: string) {
    const existing = await this.ledgerAccountRepository.getByCode(controlCenterId, OPENING_EQUITY_CODE);
    if (existing) {
      return existing;
    }

    const created = {
      id: crypto.randomUUID(),
      controlCenterId,
      code: OPENING_EQUITY_CODE,
      name: 'PL - Saldos Iniciais',
      kind: 'equity' as const,
      isSystem: true,
      createdAt: new Date().toISOString(),
    };

    await this.ledgerAccountRepository.save(created);
    return created;
  }

  private buildOpeningEntry(
    account: Account,
    targetLedgerAccountId: string,
    openingEquityAccountId: string,
    amountCents: number,
  ): LedgerEntry {
    const isAsset = account.nature === 'asset';

    return {
      id: crypto.randomUUID(),
      controlCenterId: account.controlCenterId,
      date: new Date().toISOString(),
      description: `Saldo inicial - ${account.name}`,
      referenceType: 'account_opening',
      referenceId: account.id,
      lines: [
        {
          ledgerAccountId: isAsset ? targetLedgerAccountId : openingEquityAccountId,
          debitCents: amountCents,
          creditCents: 0,
        },
        {
          ledgerAccountId: isAsset ? openingEquityAccountId : targetLedgerAccountId,
          debitCents: 0,
          creditCents: amountCents,
        },
      ],
      createdAt: new Date().toISOString(),
    };
  }
}
