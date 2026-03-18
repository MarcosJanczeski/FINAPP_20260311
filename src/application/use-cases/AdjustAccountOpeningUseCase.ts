import type { Account } from '../../domain/entities/Account';
import type { LedgerEntry } from '../../domain/entities/LedgerEntry';
import type { AccountRepository } from '../../domain/repositories/AccountRepository';
import type { LedgerAccountRepository } from '../../domain/repositories/LedgerAccountRepository';
import type { LedgerEntryRepository } from '../../domain/repositories/LedgerEntryRepository';
import type { AdjustAccountOpeningInputDTO } from '../dto/AccountSetupDTO';
import { assertPostingLedgerLines } from '../services/ledgerPostingGuard';

const OPENING_EQUITY_CODE = 'PL:SALDOS_INICIAIS';
const EQUITY_ROOT_CODE = 'PATRIMONIO_LIQUIDO';

export class AdjustAccountOpeningUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly ledgerAccountRepository: LedgerAccountRepository,
    private readonly ledgerEntryRepository: LedgerEntryRepository,
  ) {}

  async execute(input: AdjustAccountOpeningInputDTO): Promise<Account> {
    const account = await this.accountRepository.getById(input.accountId);
    if (!account || account.controlCenterId !== input.controlCenterId) {
      throw new Error('Conta nao encontrada para este centro de controle.');
    }

    if (account.status === 'closed') {
      throw new Error('Conta encerrada nao permite ajuste de saldo inicial.');
    }

    const openingBalanceCents = Math.trunc(input.openingBalanceCents);
    if (openingBalanceCents < 0) {
      throw new Error('Saldo inicial nao pode ser negativo.');
    }

    const reason = input.reason.trim();
    if (!reason) {
      throw new Error('Motivo do ajuste contabil e obrigatorio.');
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

    const hasAccountingChange =
      account.nature !== input.nature ||
      account.ledgerAccountId !== input.ledgerAccountId ||
      account.openingBalanceCents !== openingBalanceCents;

    if (!hasAccountingChange) {
      throw new Error('Nenhuma alteracao contabil detectada.');
    }

    const openingEquity = await this.ensureOpeningEquityAccount(input.controlCenterId);

    if (account.openingBalanceCents > 0) {
      const reversalEntry = this.buildReversalEntry({
        account,
        openingEquityAccountId: openingEquity.id,
        reason,
        userId: input.updatedByUserId,
      });
      await assertPostingLedgerLines({
        controlCenterId: input.controlCenterId,
        lines: reversalEntry.lines,
        ledgerAccountRepository: this.ledgerAccountRepository,
      });
      await this.ledgerEntryRepository.save(reversalEntry);
    }

    const updatedAccount: Account = {
      ...account,
      nature: input.nature,
      ledgerAccountId: input.ledgerAccountId,
      openingBalanceCents,
      updatedAt: new Date().toISOString(),
    };

    await this.accountRepository.save(updatedAccount);

    if (openingBalanceCents > 0) {
      const adjustmentEntry = this.buildAdjustmentEntry({
        account: updatedAccount,
        openingEquityAccountId: openingEquity.id,
        reason,
        userId: input.updatedByUserId,
      });
      await assertPostingLedgerLines({
        controlCenterId: input.controlCenterId,
        lines: adjustmentEntry.lines,
        ledgerAccountRepository: this.ledgerAccountRepository,
      });
      await this.ledgerEntryRepository.save(adjustmentEntry);
    }

    return updatedAccount;
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
      accountRole: 'posting' as const,
      parentLedgerAccountId:
        (await this.ledgerAccountRepository.getByCode(controlCenterId, EQUITY_ROOT_CODE))?.id ?? null,
      isSystem: true,
      status: 'active' as const,
      createdAt: new Date().toISOString(),
    };

    await this.ledgerAccountRepository.save(created);
    return created;
  }

  private buildReversalEntry(input: {
    account: Account;
    openingEquityAccountId: string;
    reason: string;
    userId: string;
  }): LedgerEntry {
    const now = new Date().toISOString();
    const isAsset = input.account.nature === 'asset';

    return {
      id: crypto.randomUUID(),
      controlCenterId: input.account.controlCenterId,
      date: now,
      description: `Reversao saldo inicial - ${input.account.name}`,
      referenceType: 'account_opening_reversal',
      referenceId: input.account.id,
      lines: [
        {
          ledgerAccountId: isAsset ? input.openingEquityAccountId : input.account.ledgerAccountId,
          debitCents: input.account.openingBalanceCents,
          creditCents: 0,
        },
        {
          ledgerAccountId: isAsset ? input.account.ledgerAccountId : input.openingEquityAccountId,
          debitCents: 0,
          creditCents: input.account.openingBalanceCents,
        },
      ],
      createdByUserId: input.userId,
      reason: input.reason,
      createdAt: now,
    };
  }

  private buildAdjustmentEntry(input: {
    account: Account;
    openingEquityAccountId: string;
    reason: string;
    userId: string;
  }): LedgerEntry {
    const now = new Date().toISOString();
    const isAsset = input.account.nature === 'asset';

    return {
      id: crypto.randomUUID(),
      controlCenterId: input.account.controlCenterId,
      date: now,
      description: `Ajuste saldo inicial - ${input.account.name}`,
      referenceType: 'account_opening_adjustment',
      referenceId: input.account.id,
      lines: [
        {
          ledgerAccountId: isAsset ? input.account.ledgerAccountId : input.openingEquityAccountId,
          debitCents: input.account.openingBalanceCents,
          creditCents: 0,
        },
        {
          ledgerAccountId: isAsset ? input.openingEquityAccountId : input.account.ledgerAccountId,
          debitCents: 0,
          creditCents: input.account.openingBalanceCents,
        },
      ],
      createdByUserId: input.userId,
      reason: input.reason,
      createdAt: now,
    };
  }
}
