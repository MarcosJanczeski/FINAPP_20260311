import { describe, expect, it } from 'vitest';

import { RemoveOrArchiveChartOfAccountsNodeUseCase } from '../RemoveOrArchiveChartOfAccountsNodeUseCase';
import type { LedgerAccount } from '../../../domain/entities/LedgerAccount';
import type { LedgerEntry } from '../../../domain/entities/LedgerEntry';
import type { LedgerAccountRepository } from '../../../domain/repositories/LedgerAccountRepository';
import type { LedgerEntryRepository } from '../../../domain/repositories/LedgerEntryRepository';

class InMemoryLedgerAccountRepository implements LedgerAccountRepository {
  constructor(private readonly accounts: LedgerAccount[]) {}

  async getById(id: string): Promise<LedgerAccount | null> {
    return this.accounts.find((account) => account.id === id) ?? null;
  }

  async getByCode(controlCenterId: string, code: string): Promise<LedgerAccount | null> {
    return (
      this.accounts.find(
        (account) => account.controlCenterId === controlCenterId && account.code === code,
      ) ?? null
    );
  }

  async listByControlCenter(controlCenterId: string): Promise<LedgerAccount[]> {
    return this.accounts.filter((account) => account.controlCenterId === controlCenterId);
  }

  async save(account: LedgerAccount): Promise<void> {
    const index = this.accounts.findIndex((current) => current.id === account.id);
    if (index >= 0) {
      this.accounts[index] = account;
      return;
    }
    this.accounts.push(account);
  }

  async delete(id: string): Promise<void> {
    const index = this.accounts.findIndex((account) => account.id === id);
    if (index >= 0) {
      this.accounts.splice(index, 1);
    }
  }
}

class InMemoryLedgerEntryRepository implements LedgerEntryRepository {
  constructor(private readonly entries: LedgerEntry[]) {}

  async getById(id: string): Promise<LedgerEntry | null> {
    return this.entries.find((entry) => entry.id === id) ?? null;
  }

  async listByControlCenter(controlCenterId: string): Promise<LedgerEntry[]> {
    return this.entries.filter((entry) => entry.controlCenterId === controlCenterId);
  }

  async save(entry: LedgerEntry): Promise<void> {
    const index = this.entries.findIndex((current) => current.id === entry.id);
    if (index >= 0) {
      this.entries[index] = entry;
      return;
    }
    this.entries.push(entry);
  }
}

function buildAccount(input: Partial<LedgerAccount> & Pick<LedgerAccount, 'id' | 'code'>): LedgerAccount {
  return {
    id: input.id,
    controlCenterId: input.controlCenterId ?? 'cc-1',
    code: input.code,
    name: input.name ?? input.code,
    kind: input.kind ?? 'asset',
    accountRole: input.accountRole ?? 'posting',
    parentLedgerAccountId: input.parentLedgerAccountId ?? null,
    status: input.status ?? 'active',
    isSystem: input.isSystem ?? false,
    createdAt: input.createdAt ?? '2026-03-01T00:00:00.000Z',
  };
}

function buildEntry(input: Partial<LedgerEntry> & Pick<LedgerEntry, 'id' | 'referenceType' | 'referenceId'>): LedgerEntry {
  return {
    id: input.id,
    controlCenterId: input.controlCenterId ?? 'cc-1',
    date: input.date ?? '2026-03-10T00:00:00.000Z',
    description: input.description ?? 'entry',
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    lines: input.lines ?? [],
    createdAt: input.createdAt ?? '2026-03-10T00:00:00.000Z',
    createdByUserId: input.createdByUserId,
    reason: input.reason,
    reversalOf: input.reversalOf,
  };
}

describe('RemoveOrArchiveChartOfAccountsNodeUseCase', () => {
  it('bloqueia raiz obrigatoria', async () => {
    const useCase = new RemoveOrArchiveChartOfAccountsNodeUseCase(
      new InMemoryLedgerAccountRepository([
        buildAccount({ id: 'root-1', code: 'ATIVO', accountRole: 'grouping', isSystem: true }),
      ]),
      new InMemoryLedgerEntryRepository([]),
    );

    await expect(
      useCase.execute({ controlCenterId: 'cc-1', ledgerAccountId: 'root-1' }),
    ).rejects.toThrow('Raiz obrigatoria nao pode ser removida neste fluxo.');
  });

  it('bloqueia conta de sistema', async () => {
    const useCase = new RemoveOrArchiveChartOfAccountsNodeUseCase(
      new InMemoryLedgerAccountRepository([
        buildAccount({
          id: 'sys-1',
          code: 'PL:SALDOS_INICIAIS',
          kind: 'equity',
          accountRole: 'posting',
          isSystem: true,
        }),
      ]),
      new InMemoryLedgerEntryRepository([]),
    );

    await expect(
      useCase.execute({ controlCenterId: 'cc-1', ledgerAccountId: 'sys-1' }),
    ).rejects.toThrow('Conta de sistema nao pode ser removida neste fluxo.');
  });

  it('bloqueia conta com filhos', async () => {
    const repo = new InMemoryLedgerAccountRepository([
      buildAccount({ id: 'g-1', code: 'ATIVO:DISPONIBILIDADES', accountRole: 'grouping' }),
      buildAccount({
        id: 'c-1',
        code: 'ATIVO:DISPONIBILIDADES:CARTEIRA',
        accountRole: 'posting',
        parentLedgerAccountId: 'g-1',
      }),
    ]);

    const useCase = new RemoveOrArchiveChartOfAccountsNodeUseCase(
      repo,
      new InMemoryLedgerEntryRepository([]),
    );

    await expect(
      useCase.execute({ controlCenterId: 'cc-1', ledgerAccountId: 'g-1' }),
    ).rejects.toThrow('Conta com filhos nao pode ser removida ou inativada neste fluxo.');
  });

  it('exclui fisicamente conta sem filhos e sem uso', async () => {
    const repo = new InMemoryLedgerAccountRepository([
      buildAccount({ id: 'n-1', code: 'DESPESAS:SERVICOS:AGUA', kind: 'expense' }),
    ]);

    const useCase = new RemoveOrArchiveChartOfAccountsNodeUseCase(
      repo,
      new InMemoryLedgerEntryRepository([]),
    );

    const result = await useCase.execute({ controlCenterId: 'cc-1', ledgerAccountId: 'n-1' });

    expect(result.outcome).toBe('deleted');
    await expect(repo.getById('n-1')).resolves.toBeNull();
  });

  it('inativa conta sem filhos com uso e preserva estrutura', async () => {
    const repo = new InMemoryLedgerAccountRepository([
      buildAccount({
        id: 'n-1',
        code: 'PASSIVO:OBRIGACOES:FORNECEDORES',
        kind: 'liability',
        accountRole: 'posting',
        parentLedgerAccountId: 'parent-1',
      }),
    ]);

    const entries = new InMemoryLedgerEntryRepository([
      buildEntry({
        id: 'le-1',
        referenceType: 'recurrence_recognition',
        referenceId: 'ref-1',
        lines: [
          { ledgerAccountId: 'n-1', debitCents: 1000, creditCents: 0 },
          { ledgerAccountId: 'other', debitCents: 0, creditCents: 1000 },
        ],
      }),
    ]);

    const useCase = new RemoveOrArchiveChartOfAccountsNodeUseCase(repo, entries);
    const result = await useCase.execute({ controlCenterId: 'cc-1', ledgerAccountId: 'n-1' });

    expect(result.outcome).toBe('archived');

    const saved = await repo.getById('n-1');
    expect(saved?.status).toBe('inactive');
    expect(saved?.code).toBe('PASSIVO:OBRIGACOES:FORNECEDORES');
    expect(saved?.parentLedgerAccountId).toBe('parent-1');
    expect(saved?.kind).toBe('liability');
    expect(saved?.accountRole).toBe('posting');
  });
});
