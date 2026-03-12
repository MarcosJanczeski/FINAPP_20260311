import type { LedgerAccount } from '../../domain/entities/LedgerAccount';
import type { AccountRepository } from '../../domain/repositories/AccountRepository';
import type { ControlCenterRepository } from '../../domain/repositories/ControlCenterRepository';
import type { LedgerAccountRepository } from '../../domain/repositories/LedgerAccountRepository';
import type { LedgerEntryRepository } from '../../domain/repositories/LedgerEntryRepository';
import type { ID } from '../../domain/types/common';
import type { AccountsSetupDTO } from '../dto/AccountSetupDTO';

const DEFAULT_LEDGER_ACCOUNTS: ReadonlyArray<Omit<LedgerAccount, 'id' | 'createdAt' | 'controlCenterId'>> =
  [
    {
      code: 'ATIVO:DISPONIBILIDADES',
      name: 'Ativo - Disponibilidades',
      kind: 'asset',
      isSystem: true,
    },
    {
      code: 'PASSIVO:OBRIGACOES',
      name: 'Passivo - Obrigações',
      kind: 'liability',
      isSystem: true,
    },
    {
      code: 'PL:SALDOS_INICIAIS',
      name: 'PL - Saldos Iniciais',
      kind: 'equity',
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

    const [accounts, ledgerAccounts, ledgerEntries] = await Promise.all([
      this.accountRepository.listByControlCenter(controlCenter.id),
      this.ledgerAccountRepository.listByControlCenter(controlCenter.id),
      this.ledgerEntryRepository.listByControlCenter(controlCenter.id),
    ]);

    return {
      controlCenterId: controlCenter.id,
      accounts,
      ledgerAccounts,
      openingEntries: ledgerEntries.filter((entry) => entry.referenceType === 'account_opening'),
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
}
