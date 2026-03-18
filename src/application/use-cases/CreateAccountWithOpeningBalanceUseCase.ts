import type { Account } from '../../domain/entities/Account';
import type { LedgerEntry } from '../../domain/entities/LedgerEntry';
import type { AccountRepository } from '../../domain/repositories/AccountRepository';
import type { LedgerAccountRepository } from '../../domain/repositories/LedgerAccountRepository';
import type { LedgerEntryRepository } from '../../domain/repositories/LedgerEntryRepository';
import type { CreateAccountInputDTO } from '../dto/AccountSetupDTO';
import { assertPostingLedgerLines } from '../services/ledgerPostingGuard';

const OPENING_EQUITY_CODE = 'PL:SALDOS_INICIAIS';
const AVAILABILITY_BUCKET_CODE = 'ATIVO:DISPONIBILIDADES';
const EQUITY_ROOT_CODE = 'PATRIMONIO_LIQUIDO';

function isOperationalAvailabilityAccount(input: CreateAccountInputDTO): boolean {
  return (
    input.nature === 'asset' &&
    (
      input.type === 'cash' ||
      input.type === 'checking' ||
      input.type === 'digital' ||
      input.type === 'savings'
    )
  );
}

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

    const isAvailability = isOperationalAvailabilityAccount(input);
    const ledgerAccount = isAvailability
      ? await this.ensureSpecificAvailabilityLedgerAccount(input.controlCenterId, name)
      : await this.resolveSelectedLedgerAccount(input);

    const openingEquity = await this.ensureOpeningEquityAccount(input.controlCenterId);
    const now = new Date().toISOString();

    const account: Account = {
      id: crypto.randomUUID(),
      controlCenterId: input.controlCenterId,
      name,
      type: input.type,
      nature: input.nature,
      ledgerAccountId: ledgerAccount.id,
      openingBalanceCents,
      status: 'active',
      closedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await this.accountRepository.save(account);

    if (openingBalanceCents > 0) {
      const entry = this.buildOpeningLikeEntry({
        controlCenterId: account.controlCenterId,
        referenceId: account.id,
        referenceType: 'account_opening',
        description: `Saldo inicial - ${account.name}`,
        isAsset: account.nature === 'asset',
        targetLedgerAccountId: account.ledgerAccountId,
        openingEquityAccountId: openingEquity.id,
        amountCents: openingBalanceCents,
        userId: input.createdByUserId,
      });
      await assertPostingLedgerLines({
        controlCenterId: account.controlCenterId,
        lines: entry.lines,
        ledgerAccountRepository: this.ledgerAccountRepository,
      });
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

  private async resolveSelectedLedgerAccount(input: CreateAccountInputDTO) {
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

    return ledgerAccount;
  }

  private async ensureSpecificAvailabilityLedgerAccount(controlCenterId: string, accountName: string) {
    const normalizedName = accountName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 24);
    const suffix = crypto.randomUUID().slice(0, 6).toUpperCase();
    const code = `${AVAILABILITY_BUCKET_CODE}:${normalizedName || 'CONTA'}_${suffix}`;

    const created = {
      id: crypto.randomUUID(),
      controlCenterId,
      code,
      name: `Disponibilidades - ${accountName}`,
      kind: 'asset' as const,
      accountRole: 'posting' as const,
      parentLedgerAccountId:
        (await this.ledgerAccountRepository.getByCode(controlCenterId, AVAILABILITY_BUCKET_CODE))?.id ??
        null,
      isSystem: false,
      status: 'active' as const,
      createdAt: new Date().toISOString(),
    };

    await this.ledgerAccountRepository.save(created);
    return created;
  }

  private buildOpeningLikeEntry(input: {
    controlCenterId: string;
    referenceId: string;
    referenceType: 'account_opening' | 'account_opening_adjustment';
    description: string;
    isAsset: boolean;
    targetLedgerAccountId: string;
    openingEquityAccountId: string;
    amountCents: number;
    userId: string;
    reason?: string;
  }): LedgerEntry {
    const now = new Date().toISOString();

    return {
      id: crypto.randomUUID(),
      controlCenterId: input.controlCenterId,
      date: now,
      description: input.description,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      lines: [
        {
          ledgerAccountId: input.isAsset ? input.targetLedgerAccountId : input.openingEquityAccountId,
          debitCents: input.amountCents,
          creditCents: 0,
        },
        {
          ledgerAccountId: input.isAsset ? input.openingEquityAccountId : input.targetLedgerAccountId,
          debitCents: 0,
          creditCents: input.amountCents,
        },
      ],
      createdByUserId: input.userId,
      reason: input.reason,
      createdAt: now,
    };
  }
}
