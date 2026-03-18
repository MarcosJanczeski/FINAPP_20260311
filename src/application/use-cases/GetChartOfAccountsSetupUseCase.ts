import type { LedgerAccount, LedgerAccountKind } from '../../domain/entities/LedgerAccount';
import type { ControlCenterRepository } from '../../domain/repositories/ControlCenterRepository';
import type { LedgerAccountRepository } from '../../domain/repositories/LedgerAccountRepository';
import type { LedgerEntryRepository } from '../../domain/repositories/LedgerEntryRepository';
import type { ID } from '../../domain/types/common';
import type {
  ChartOfAccountsCapabilitiesDTO,
  ChartOfAccountsNodeDTO,
  ChartOfAccountsNodeType,
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

    const codeCount = new Map<string, number>();
    for (const account of ledgerAccounts) {
      codeCount.set(account.code, (codeCount.get(account.code) ?? 0) + 1);
    }

    const roots = ROOT_ORDER.map((rootCode) =>
      ledgerAccounts.find((account) => account.code === rootCode) ??
      this.buildVirtualRoot(controlCenter.id, rootCode),
    );

    const rootsByKind = new Map<LedgerAccountKind, LedgerAccount>(
      roots.map((rootAccount) => [rootAccount.kind, rootAccount]),
    );
    const accountsByCode = this.groupAccountsByCode(ledgerAccounts);
    const rootIds = new Set(roots.map((root) => root.id));

    const accountById = new Map(ledgerAccounts.map((account) => [account.id, account]));
    const parentByAccountId = new Map<ID, ID | null>();
    for (const root of roots) {
      parentByAccountId.set(root.id, null);
    }

    const nonRootAccounts = ledgerAccounts.filter((account) => !rootIds.has(account.id));
    for (const account of nonRootAccounts) {
      parentByAccountId.set(
        account.id,
        this.resolveParentId({
          account,
          accountById,
          accountsByCode,
          rootsByKind,
        }),
      );
    }

    const childrenByParentId = new Map<ID, LedgerAccount[]>();
    for (const account of nonRootAccounts) {
      const parentId = parentByAccountId.get(account.id);
      if (!parentId) {
        continue;
      }
      const siblings = childrenByParentId.get(parentId) ?? [];
      siblings.push(account);
      childrenByParentId.set(parentId, siblings);
    }

    const rootsNodes = roots
      .slice()
      .sort((left, right) => ROOT_ORDER.indexOf(left.code as ChartOfAccountsRootCode) - ROOT_ORDER.indexOf(right.code as ChartOfAccountsRootCode))
      .map((root) =>
        this.buildNode({
          account: root,
          parentId: null,
          childrenByParentId,
          usageCountByAccount,
          codeCount,
        }),
      );

    return {
      controlCenterId: controlCenter.id,
      roots: rootsNodes,
    };
  }

  private buildVirtualRoot(controlCenterId: ID, code: ChartOfAccountsRootCode): LedgerAccount {
    return {
      id: `virtual-root-${code}` as ID,
      controlCenterId,
      code,
      name: code.replace(/_/g, ' '),
      kind: ROOT_KIND_BY_CODE[code],
      accountRole: 'grouping',
      parentLedgerAccountId: null,
      isSystem: true,
      createdAt: new Date(0).toISOString(),
    };
  }

  private isRootAccount(account: LedgerAccount): account is LedgerAccount & { code: ChartOfAccountsRootCode } {
    return ROOT_ORDER.includes(account.code as ChartOfAccountsRootCode);
  }

  private groupAccountsByCode(accounts: LedgerAccount[]): Map<string, LedgerAccount[]> {
    const map = new Map<string, LedgerAccount[]>();
    for (const account of accounts) {
      const current = map.get(account.code) ?? [];
      current.push(account);
      map.set(account.code, current);
    }
    return map;
  }

  private resolveParentId(input: {
    account: LedgerAccount;
    accountById: Map<ID, LedgerAccount>;
    accountsByCode: Map<string, LedgerAccount[]>;
    rootsByKind: Map<LedgerAccountKind, LedgerAccount>;
  }): ID {
    if (input.account.parentLedgerAccountId) {
      const explicitParent = input.accountById.get(input.account.parentLedgerAccountId);
      if (explicitParent && explicitParent.kind === input.account.kind) {
        return explicitParent.id;
      }
    }

    const account = input.account;
    const codeSegments = account.code.split(':');
    for (let i = codeSegments.length - 1; i > 0; i -= 1) {
      const candidateCode = codeSegments.slice(0, i).join(':');
      const candidates = (input.accountsByCode.get(candidateCode) ?? [])
        .filter((candidate) => candidate.id !== account.id && candidate.kind === account.kind)
        .sort((left, right) => this.compareAccounts(left, right));
      if (candidates.length > 0) {
        return candidates[0].id;
      }
    }

    const rootByKind = input.rootsByKind.get(account.kind);
    if (!rootByKind) {
      throw new Error(`Raiz obrigatoria nao encontrada para o tipo ${account.kind}.`);
    }
    return rootByKind.id;
  }

  private buildNode(input: {
    account: LedgerAccount;
    parentId: ID | null;
    childrenByParentId: Map<ID, LedgerAccount[]>;
    usageCountByAccount: Map<ID, number>;
    codeCount: Map<string, number>;
  }): ChartOfAccountsNodeDTO {
    const childrenAccounts = (input.childrenByParentId.get(input.account.id) ?? [])
      .slice()
      .sort((left, right) => this.compareAccounts(left, right));
    const children = childrenAccounts.map((child) =>
      this.buildNode({
        account: child,
        parentId: input.account.id,
        childrenByParentId: input.childrenByParentId,
        usageCountByAccount: input.usageCountByAccount,
        codeCount: input.codeCount,
      }),
    );

    const nodeType = this.resolveNodeType(input.account);
    const usageCount = input.usageCountByAccount.get(input.account.id) ?? 0;
    const capabilities = this.resolveCapabilities({
      nodeType,
      isSystem: input.account.isSystem,
      usageCount,
      hasChildren: children.length > 0,
    });

    const codeConflictCount = input.codeCount.get(input.account.code) ?? 0;

    return {
      id: input.account.id,
      parentId: input.parentId,
      code: input.account.code,
      name: input.account.name,
      kind: input.account.kind,
      nodeType,
      isSystem: input.account.isSystem,
      isTechnical: input.account.isSystem && nodeType !== 'root',
      usageCount,
      hasLedgerEntries: usageCount > 0,
      hasCodeConflict: codeConflictCount > 1,
      codeConflictCount,
      capabilities,
      children,
    };
  }

  private resolveNodeType(account: LedgerAccount): ChartOfAccountsNodeType {
    if (this.isRootAccount(account)) {
      return 'root';
    }

    if (account.accountRole === 'grouping') {
      return 'grouping';
    }

    return 'leaf';
  }

  private resolveCapabilities(input: {
    nodeType: ChartOfAccountsNodeType;
    isSystem: boolean;
    usageCount: number;
    hasChildren: boolean;
  }): ChartOfAccountsCapabilitiesDTO {
    if (input.nodeType === 'root') {
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

    if (input.nodeType === 'grouping') {
      return {
        canEdit: true,
        canCreateChild: true,
        canArchive: false,
        canDelete: false,
      };
    }

    return {
      canEdit: true,
      canCreateChild: false,
      canArchive: input.usageCount === 0 && !input.hasChildren,
      canDelete: input.usageCount === 0 && !input.hasChildren,
    };
  }

  private compareAccounts(left: LedgerAccount, right: LedgerAccount): number {
    return `${left.code}|${left.name}`.localeCompare(`${right.code}|${right.name}`);
  }
}
