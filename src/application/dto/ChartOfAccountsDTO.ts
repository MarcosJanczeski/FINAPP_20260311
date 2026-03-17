import type { LedgerAccountKind } from '../../domain/entities/LedgerAccount';
import type { ID } from '../../domain/types/common';

export type ChartOfAccountsRootCode =
  | 'ATIVO'
  | 'PASSIVO'
  | 'PATRIMONIO_LIQUIDO'
  | 'RECEITAS'
  | 'DESPESAS';

export interface ChartOfAccountsCapabilitiesDTO {
  canEdit: boolean;
  canCreateChild: boolean;
  canArchive: boolean;
  canDelete: boolean;
}

export interface ChartOfAccountsItemDTO {
  id: ID;
  code: string;
  name: string;
  kind: LedgerAccountKind;
  isRoot: boolean;
  isSystem: boolean;
  isTechnical: boolean;
  hasLedgerEntries: boolean;
  usageCount: number;
  capabilities: ChartOfAccountsCapabilitiesDTO;
}

export interface ChartOfAccountsGroupDTO {
  rootCode: ChartOfAccountsRootCode;
  root: ChartOfAccountsItemDTO;
  children: ChartOfAccountsItemDTO[];
}

export interface ChartOfAccountsSetupDTO {
  controlCenterId: ID;
  groups: ChartOfAccountsGroupDTO[];
}
