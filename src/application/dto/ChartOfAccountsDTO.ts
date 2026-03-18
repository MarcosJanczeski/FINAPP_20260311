import type { LedgerAccountKind, LedgerAccountStatus } from '../../domain/entities/LedgerAccount';
import type { ID } from '../../domain/types/common';

export type ChartOfAccountsRootCode =
  | 'ATIVO'
  | 'PASSIVO'
  | 'PATRIMONIO_LIQUIDO'
  | 'RECEITAS'
  | 'DESPESAS';

export type ChartOfAccountsNodeType = 'root' | 'grouping' | 'leaf';

export interface ChartOfAccountsCapabilitiesDTO {
  canEdit: boolean;
  canCreateChild: boolean;
  canArchive: boolean;
  canDelete: boolean;
}

export interface ChartOfAccountsNodeDTO {
  id: ID;
  parentId: ID | null;
  code: string;
  name: string;
  kind: LedgerAccountKind;
  nodeType: ChartOfAccountsNodeType;
  status: LedgerAccountStatus;
  isSystem: boolean;
  isTechnical: boolean;
  hasLedgerEntries: boolean;
  usageCount: number;
  hasCodeConflict: boolean;
  codeConflictCount: number;
  capabilities: ChartOfAccountsCapabilitiesDTO;
  children: ChartOfAccountsNodeDTO[];
}

export interface ChartOfAccountsSetupDTO {
  controlCenterId: ID;
  roots: ChartOfAccountsNodeDTO[];
}
