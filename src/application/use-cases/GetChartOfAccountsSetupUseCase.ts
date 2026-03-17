import type { LedgerAccount, LedgerAccountKind } from '../../domain/entities/LedgerAccount';
import type { ControlCenterRepository } from '../../domain/repositories/ControlCenterRepository';
import type { LedgerAccountRepository } from '../../domain/repositories/LedgerAccountRepository';
import type { LedgerEntryRepository } from '../../domain/repositories/LedgerEntryRepository';
import type { ID } from '../../domain/types/common';
import type {
  ChartOfAccountsCapabilitiesDTO,
  ChartOfAccountsGroupDTO,
  ChartOfAccountsItemDTO,
  ChartOfAccountsRootCode,
  ChartOfAccountsSetupDTO,
} from '../dto/ChartOfAccountsDTO';

const ROOT_ORDER: ReadonlyArray<ChartOfAccountsRootCode> = [
  'ATIVO',
  'PASSIVO',
  'PATRIMONIO_LIQUIDO',
  'RECEITAS',
  'DESPESAS',
];

const ROOT_KIND_BY_CODE: Readonly<Record<ChartOfAccountsRootCode, LedgerAccountKind>> = {
  ATIVO: 'asset',
  PASSIVO: 'liability',
  PATRIMONIO_LIQUIDO: 'equity',
  RECEITAS: 'revenue',
  DESPESAS: 'expense',
};

export class GetChartOfAccountsSetupUseCase {
  constructor(
    private readonly controlCenterRepository: ControlCenterRepository,
    private readonly ledgerAccountRepository: LedgerAccountRepository,
    private readonly ledgerEntryRepository: LedgerEntryRepository,
  ) {}

  async execute(userId: ID): Promise<ChartOfAccountsSetupDTO> {
    const centers = await this.controlCenterRepository.listByUser(userId);
    const controlCenter = centers.find((center) => center.ownerUserId === userId) ?? null;

    if (!controlCenter) {
      throw new Error('Centro de controle nao encontrado para o usuario.');
    }

    const [ledgerAccounts, ledgerEntries] = await Promise.all([
      this.ledgerAccountRepository.listByControlCenter(controlCenter.id),
      this.ledgerEntryRepository.listByControlCenter(controlCenter.id),
    ]);

    const usageCountByAccount = new Map<ID, number>();
    for (const entry of ledgerEntries) {
      const accountIdsInEntry = new Set(entry.lines.map((line) => line.ledgerAccountId));
      for (const ledgerAccountId of accountIdsInEntry) {
        usageCountByAccount.set(
          ledgerAccountId,
          (usageCountByAccount.get(ledgerAccountId) ?? 0) + 1,
        );
      }
    }

    const groups: ChartOfAccountsGroupDTO[] = ROOT_ORDER.map((rootCode) => {
      const rootAccount =
        ledgerAccounts.find((account) => account.code === rootCode) ??
        this.buildVirtualRoot(controlCenter.id, rootCode);

      const children = ledgerAccounts
        .filter((account) => !this.isRootAccount(account))
        .filter((account) => account.kind === ROOT_KIND_BY_CODE[rootCode])
        .sort((left, right) => this.compareAccounts(left, right))
        .map((account) => this.toItem(account, usageCountByAccount));

      return {
        rootCode,
        root: this.toItem(rootAccount, usageCountByAccount),
        children,
      };
    });

    return {
      controlCenterId: controlCenter.id,
      groups,
    };
  }

  private buildVirtualRoot(controlCenterId: ID, code: ChartOfAccountsRootCode): LedgerAccount {
    return {
      id: `virtual-root-${code}` as ID,
      controlCenterId,
      code,
      name: code.replace(/_/g, ' '),
      kind: ROOT_KIND_BY_CODE[code],
      isSystem: true,
      createdAt: new Date(0).toISOString(),
    };
  }

  private isRootAccount(account: LedgerAccount): account is LedgerAccount & { code: ChartOfAccountsRootCode } {
    return ROOT_ORDER.includes(account.code as ChartOfAccountsRootCode);
  }

  private toItem(
    account: LedgerAccount,
    usageCountByAccount: Map<ID, number>,
  ): ChartOfAccountsItemDTO {
    const isRoot = this.isRootAccount(account);
    const usageCount = usageCountByAccount.get(account.id) ?? 0;
    const capabilities = this.resolveCapabilities({ isRoot, isSystem: account.isSystem, usageCount });

    return {
      id: account.id,
      code: account.code,
      name: account.name,
      kind: account.kind,
      isRoot,
      isSystem: account.isSystem,
      isTechnical: account.isSystem && !isRoot,
      usageCount,
      hasLedgerEntries: usageCount > 0,
      capabilities,
    };
  }

  private resolveCapabilities(input: {
    isRoot: boolean;
    isSystem: boolean;
    usageCount: number;
  }): ChartOfAccountsCapabilitiesDTO {
    if (input.isRoot) {
      return {
        canEdit: false,
        canCreateChild: true,
        canArchive: false,
        canDelete: false,
      };
    }

    if (input.isSystem) {
      return {
        canEdit: false,
        canCreateChild: false,
        canArchive: false,
        canDelete: false,
      };
    }

    return {
      canEdit: true,
      canCreateChild: true,
      canArchive: true,
      canDelete: input.usageCount === 0,
    };
  }

  private compareAccounts(left: LedgerAccount, right: LedgerAccount): number {
    return `${left.code}|${left.name}`.localeCompare(`${right.code}|${right.name}`);
  }
}
