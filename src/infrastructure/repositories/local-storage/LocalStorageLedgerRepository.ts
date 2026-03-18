import type { LedgerAccount } from '../../../domain/entities/LedgerAccount';
import type { LedgerEntry } from '../../../domain/entities/LedgerEntry';
import type { LedgerAccountRepository } from '../../../domain/repositories/LedgerAccountRepository';
import type { LedgerEntryRepository } from '../../../domain/repositories/LedgerEntryRepository';
import type { ID } from '../../../domain/types/common';
import type { StorageDriver } from '../../storage/local-storage/driver';
import { STORAGE_KEYS } from '../../storage/local-storage/keys';

export class LocalStorageLedgerAccountRepository implements LedgerAccountRepository {
  constructor(private readonly storage: StorageDriver) {}

  async getById(id: ID): Promise<LedgerAccount | null> {
    return this.readAccounts().find((account) => account.id === id) ?? null;
  }

  async getByCode(controlCenterId: ID, code: string): Promise<LedgerAccount | null> {
    return (
      this.readAccounts().find(
        (account) => account.controlCenterId === controlCenterId && account.code === code,
      ) ?? null
    );
  }

  async listByControlCenter(controlCenterId: ID): Promise<LedgerAccount[]> {
    return this.readAccounts().filter((account) => account.controlCenterId === controlCenterId);
  }

  async save(account: LedgerAccount): Promise<void> {
    const accounts = this.readAccounts();
    const index = accounts.findIndex((current) => current.id === account.id);

    if (index >= 0) {
      accounts[index] = account;
    } else {
      accounts.push(account);
    }

    this.storage.setItem<LedgerAccount[]>(STORAGE_KEYS.ledgerAccounts, accounts);
  }

  private readAccounts(): LedgerAccount[] {
    const rawAccounts = this.storage.getItem<Array<Partial<LedgerAccount>>>(STORAGE_KEYS.ledgerAccounts) ?? [];

    const rootCodeByKind: Record<LedgerAccount['kind'], string> = {
      asset: 'ATIVO',
      liability: 'PASSIVO',
      equity: 'PATRIMONIO_LIQUIDO',
      revenue: 'RECEITAS',
      expense: 'DESPESAS',
    };
    const rootCodes = new Set(Object.values(rootCodeByKind));

    const byCode = new Map<string, Array<Partial<LedgerAccount>>>();
    for (const account of rawAccounts) {
      if (!account.code) {
        continue;
      }
      const current = byCode.get(account.code) ?? [];
      current.push(account);
      byCode.set(account.code, current);
    }

    const resolveFallbackParent = (account: Partial<LedgerAccount>): string | null => {
      if (!account.code || !account.kind) {
        return null;
      }
      const codeSegments = account.code.split(':');
      for (let i = codeSegments.length - 1; i > 0; i -= 1) {
        const candidateCode = codeSegments.slice(0, i).join(':');
        const parent = (byCode.get(candidateCode) ?? [])
          .find((candidate) => candidate.id && candidate.kind === account.kind);
        if (parent?.id) {
          return parent.id;
        }
      }
      const rootCode = rootCodeByKind[account.kind];
      const root = (byCode.get(rootCode) ?? []).find((candidate) => candidate.id);
      return root?.id ?? null;
    };

    return rawAccounts.map((account) => {
      const code = account.code ?? '';
      const isRoot = rootCodes.has(code);
      const inferredRole = isRoot
        ? 'grouping'
        : code === 'ATIVO:DISPONIBILIDADES'
          ? 'grouping'
          : 'posting';

      return {
        id: account.id as LedgerAccount['id'],
        controlCenterId: account.controlCenterId as LedgerAccount['controlCenterId'],
        code,
        name: account.name ?? code,
        kind: account.kind as LedgerAccount['kind'],
        accountRole: account.accountRole ?? inferredRole,
        parentLedgerAccountId:
          account.parentLedgerAccountId !== undefined
            ? account.parentLedgerAccountId
            : isRoot
              ? null
              : resolveFallbackParent(account),
        isSystem: Boolean(account.isSystem),
        createdAt: account.createdAt ?? new Date(0).toISOString(),
      };
    });
  }
}

export class LocalStorageLedgerEntryRepository implements LedgerEntryRepository {
  constructor(private readonly storage: StorageDriver) {}

  async getById(id: ID): Promise<LedgerEntry | null> {
    return this.readEntries().find((entry) => entry.id === id) ?? null;
  }

  async listByControlCenter(controlCenterId: ID): Promise<LedgerEntry[]> {
    return this.readEntries().filter((entry) => entry.controlCenterId === controlCenterId);
  }

  async save(entry: LedgerEntry): Promise<void> {
    const entries = this.readEntries();
    const index = entries.findIndex((current) => current.id === entry.id);

    if (index >= 0) {
      entries[index] = entry;
    } else {
      entries.push(entry);
    }

    this.storage.setItem<LedgerEntry[]>(STORAGE_KEYS.ledgerEntries, entries);
  }

  private readEntries(): LedgerEntry[] {
    return this.storage.getItem<LedgerEntry[]>(STORAGE_KEYS.ledgerEntries) ?? [];
  }
}
