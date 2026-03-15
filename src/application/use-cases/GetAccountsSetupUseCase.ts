import type { LedgerAccount } from '../../domain/entities/LedgerAccount';
import type { AccountRepository } from '../../domain/repositories/AccountRepository';
import type { ControlCenterRepository } from '../../domain/repositories/ControlCenterRepository';
import type { LedgerAccountRepository } from '../../domain/repositories/LedgerAccountRepository';
import type { LedgerEntryRepository } from '../../domain/repositories/LedgerEntryRepository';
import type { ID } from '../../domain/types/common';
import type { AccountsSetupDTO } from '../dto/AccountSetupDTO';
import { getCurrentBalanceFromLedger } from '../services/accountAvailabilityLedger';

const AVAILABILITY_BUCKET_CODE = 'ATIVO:DISPONIBILIDADES';

const DEFAULT_LEDGER_ACCOUNTS: ReadonlyArray<Omit<LedgerAccount, 'id' | 'createdAt' | 'controlCenterId'>> =
  [
    { code: 'ATIVO', name: 'ATIVO', kind: 'asset', isSystem: true },
    { code: 'PASSIVO', name: 'PASSIVO', kind: 'liability', isSystem: true },
    {
      code: 'PATRIMONIO_LIQUIDO',
      name: 'PATRIMONIO LIQUIDO',
      kind: 'equity',
      isSystem: true,
    },
    { code: 'RECEITAS', name: 'RECEITAS', kind: 'revenue', isSystem: true },
    { code: 'DESPESAS', name: 'DESPESAS', kind: 'expense', isSystem: true },
    {
      code: 'ATIVO:DISPONIBILIDADES',
      name: 'Ativo - Disponibilidades',
      kind: 'asset',
      isSystem: true,
    },
    {
      code: 'ATIVO:RECEBIVEIS',
      name: 'Ativo - Recebiveis',
      kind: 'asset',
      isSystem: true,
    },
    {
      code: 'PASSIVO:OBRIGACOES',
      name: 'Passivo - Obrigacoes',
      kind: 'liability',
      isSystem: true,
    },
    {
      code: 'PL:SALDOS_INICIAIS',
      name: 'PL - Saldos Iniciais',
      kind: 'equity',
      isSystem: true,
    },
    {
      code: 'RECEITA:OPERACIONAL',
      name: 'Receita - Operacional',
      kind: 'revenue',
      isSystem: true,
    },
    {
      code: 'DESPESA:OPERACIONAL',
      name: 'Despesa - Operacional',
      kind: 'expense',
      isSystem: true,
    },
  ];

export class GetAccountsSetupUseCase {
  constructor(
    private readonly controlCenterRepository: ControlCenterRepository,
    private readonly accountRepository: AccountRepository,
    private readonly ledgerAccountRepository: LedgerAccountRepository,
    private readonly ledgerEntryRepository: LedgerEntryRepository,
  ) {}

  async execute(userId: ID): Promise<AccountsSetupDTO> {
    const centers = await this.controlCenterRepository.listByUser(userId);
    const controlCenter = centers.find((center) => center.ownerUserId === userId) ?? null;

    if (!controlCenter) {
      throw new Error('Centro de controle nao encontrado para o usuario.');
    }

    await this.ensureDefaultLedgerAccounts(controlCenter.id);
    await this.normalizeLegacyAvailabilityAccounts(controlCenter.id);

    const [accounts, ledgerAccounts, ledgerEntries] = await Promise.all([
      this.accountRepository.listByControlCenter(controlCenter.id),
      this.ledgerAccountRepository.listByControlCenter(controlCenter.id),
      this.ledgerEntryRepository.listByControlCenter(controlCenter.id),
    ]);

    const accountsWithCurrentBalance = accounts.map((account) => ({
      ...account,
      currentBalanceCents: getCurrentBalanceFromLedger(ledgerEntries, account.ledgerAccountId),
    }));

    return {
      controlCenterId: controlCenter.id,
      accounts: accountsWithCurrentBalance,
      ledgerAccounts,
      ledgerEntries,
    };
  }

  private async ensureDefaultLedgerAccounts(controlCenterId: ID): Promise<void> {
    for (const template of DEFAULT_LEDGER_ACCOUNTS) {
      const existing = await this.ledgerAccountRepository.getByCode(controlCenterId, template.code);
      if (existing) {
        continue;
      }

      await this.ledgerAccountRepository.save({
        id: crypto.randomUUID(),
        controlCenterId,
        code: template.code,
        name: template.name,
        kind: template.kind,
        isSystem: template.isSystem,
        createdAt: new Date().toISOString(),
      });
    }
  }

  private async normalizeLegacyAvailabilityAccounts(controlCenterId: ID): Promise<void> {
    const [accounts, ledgerAccounts] = await Promise.all([
      this.accountRepository.listByControlCenter(controlCenterId),
      this.ledgerAccountRepository.listByControlCenter(controlCenterId),
    ]);

    const ledgerAccountById = new Map(ledgerAccounts.map((account) => [account.id, account]));
    const genericAvailability = ledgerAccounts.find(
      (account) => account.code === AVAILABILITY_BUCKET_CODE,
    );
    if (!genericAvailability) {
      return;
    }

    for (const account of accounts) {
      const isAvailabilityOperational =
        account.nature === 'asset' &&
        (account.type === 'cash' || account.type === 'checking' || account.type === 'digital');
      if (!isAvailabilityOperational) {
        continue;
      }

      const currentLedgerAccount = ledgerAccountById.get(account.ledgerAccountId);
      const pointsToGeneric =
        !currentLedgerAccount ||
        currentLedgerAccount.code === AVAILABILITY_BUCKET_CODE ||
        currentLedgerAccount.id === genericAvailability.id;
      if (!pointsToGeneric) {
        continue;
      }

      const specificCode = `${AVAILABILITY_BUCKET_CODE}:ACC_${account.id.slice(0, 8).toUpperCase()}`;
      let specificLedgerAccount = await this.ledgerAccountRepository.getByCode(
        controlCenterId,
        specificCode,
      );
      if (!specificLedgerAccount) {
        specificLedgerAccount = {
          id: crypto.randomUUID(),
          controlCenterId,
          code: specificCode,
          name: `Disponibilidades - ${account.name}`,
          kind: 'asset',
          isSystem: false,
          createdAt: new Date().toISOString(),
        };
        await this.ledgerAccountRepository.save(specificLedgerAccount);
      }

      await this.accountRepository.save({
        ...account,
        ledgerAccountId: specificLedgerAccount.id,
        updatedAt: new Date().toISOString(),
      });
    }
  }
}
