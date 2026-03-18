import { describe, expect, it } from 'vitest';

import { GetChartOfAccountsSetupUseCase } from '../GetChartOfAccountsSetupUseCase';
import type { ControlCenter } from '../../../domain/entities/ControlCenter';
import type { LedgerAccount } from '../../../domain/entities/LedgerAccount';
import type { LedgerEntry } from '../../../domain/entities/LedgerEntry';
import type { ControlCenterRepository } from '../../../domain/repositories/ControlCenterRepository';
import type { LedgerAccountRepository } from '../../../domain/repositories/LedgerAccountRepository';
import type { LedgerEntryRepository } from '../../../domain/repositories/LedgerEntryRepository';

class InMemoryControlCenterRepository implements ControlCenterRepository {
  constructor(private readonly centers: ControlCenter[]) {}

  async getById(id: string): Promise<ControlCenter | null> {
    return this.centers.find((center) => center.id === id) ?? null;
  }

  async listByUser(userId: string): Promise<ControlCenter[]> {
    return this.centers.filter((center) => center.ownerUserId === userId);
  }

  async save(center: ControlCenter): Promise<void> {
    const index = this.centers.findIndex((current) => current.id === center.id);
    if (index >= 0) {
      this.centers[index] = center;
      return;
    }
    this.centers.push(center);
  }

  async delete(id: string): Promise<void> {
    const index = this.centers.findIndex((center) => center.id === id);
    if (index >= 0) {
      this.centers.splice(index, 1);
    }
  }
}

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

function buildAccount(input: Partial<LedgerAccount> & Pick<LedgerAccount, 'id' | 'code' | 'kind'>): LedgerAccount {
  return {
    id: input.id,
    controlCenterId: input.controlCenterId ?? 'cc-1',
    code: input.code,
    name: input.name ?? input.code,
    kind: input.kind,
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

describe('GetChartOfAccountsSetupUseCase', () => {
  it('nao duplica contas por code e monta arvore por parentLedgerAccountId explicito', async () => {
    const controlCenterRepo = new InMemoryControlCenterRepository([
      {
        id: 'cc-1',
        ownerUserId: 'u-1',
        personId: 'p-1',
        name: 'Principal',
        currency: 'BRL',
        createdAt: '2026-03-01T00:00:00.000Z',
      },
    ]);

    const ledgerAccountRepo = new InMemoryLedgerAccountRepository([
      buildAccount({ id: 'ativo-1', code: 'ATIVO', kind: 'asset', accountRole: 'grouping', isSystem: true }),
      buildAccount({ id: 'disp-1', code: 'ATIVO:DISPONIBILIDADES', kind: 'asset', accountRole: 'grouping', parentLedgerAccountId: 'ativo-1' }),
      buildAccount({ id: 'disp-dup-2', code: 'ATIVO:DISPONIBILIDADES', kind: 'asset', accountRole: 'posting', parentLedgerAccountId: null, createdAt: '2026-03-02T00:00:00.000Z' }),
      buildAccount({ id: 'bank-1', code: 'ATIVO:DISPONIBILIDADES:BANCO_X', kind: 'asset', accountRole: 'posting', parentLedgerAccountId: 'disp-1' }),
    ]);

    const ledgerEntryRepo = new InMemoryLedgerEntryRepository([
      buildEntry({
        id: 'le-1',
        referenceType: 'account_opening',
        referenceId: 'bank-1',
        lines: [{ ledgerAccountId: 'bank-1', debitCents: 100, creditCents: 0 }],
      }),
    ]);

    const useCase = new GetChartOfAccountsSetupUseCase(
      controlCenterRepo,
      ledgerAccountRepo,
      ledgerEntryRepo,
    );

    const setup = await useCase.execute('u-1');

    const ativoRoot = setup.roots.find((root) => root.code === 'ATIVO');
    expect(ativoRoot).toBeTruthy();
    expect(ativoRoot?.children).toHaveLength(1);
    expect(ativoRoot?.children[0].code).toBe('ATIVO:DISPONIBILIDADES');
    expect(ativoRoot?.children[0].children[0].code).toBe('ATIVO:DISPONIBILIDADES:BANCO_X');
    expect(ativoRoot?.children[0].children[0].usageCount).toBe(1);
  });

  it('usa fallback por prefixo sem gerar duplicacao na mesma raiz', async () => {
    const controlCenterRepo = new InMemoryControlCenterRepository([
      {
        id: 'cc-1',
        ownerUserId: 'u-1',
        personId: 'p-1',
        name: 'Principal',
        currency: 'BRL',
        createdAt: '2026-03-01T00:00:00.000Z',
      },
    ]);

    const ledgerAccountRepo = new InMemoryLedgerAccountRepository([
      buildAccount({ id: 'desp-1', code: 'DESPESAS', kind: 'expense', accountRole: 'grouping', isSystem: true }),
      buildAccount({ id: 'serv-1', code: 'DESPESAS:SERVICOS', kind: 'expense', accountRole: 'grouping' }),
      buildAccount({ id: 'agua-1', code: 'DESPESAS:SERVICOS:AGUA', kind: 'expense', accountRole: 'posting', parentLedgerAccountId: null }),
      buildAccount({ id: 'agua-dup', code: 'DESPESAS:SERVICOS:AGUA', kind: 'expense', accountRole: 'posting', parentLedgerAccountId: null, createdAt: '2026-03-02T00:00:00.000Z' }),
    ]);

    const ledgerEntryRepo = new InMemoryLedgerEntryRepository([]);
    const useCase = new GetChartOfAccountsSetupUseCase(
      controlCenterRepo,
      ledgerAccountRepo,
      ledgerEntryRepo,
    );

    const setup = await useCase.execute('u-1');
    const despesasRoot = setup.roots.find((root) => root.code === 'DESPESAS');

    expect(despesasRoot).toBeTruthy();
    expect(despesasRoot?.children).toHaveLength(1);
    expect(despesasRoot?.children[0].code).toBe('DESPESAS:SERVICOS');
    expect(despesasRoot?.children[0].nodeType).toBe('grouping');
    expect(despesasRoot?.children[0].children).toHaveLength(1);
    expect(despesasRoot?.children[0].children[0].code).toBe('DESPESAS:SERVICOS:AGUA');
    expect(despesasRoot?.children[0].children[0].nodeType).toBe('leaf');
  });

  it('classifica grouping vs posting corretamente no read model', async () => {
    const controlCenterRepo = new InMemoryControlCenterRepository([
      {
        id: 'cc-1',
        ownerUserId: 'u-1',
        personId: 'p-1',
        name: 'Principal',
        currency: 'BRL',
        createdAt: '2026-03-01T00:00:00.000Z',
      },
    ]);

    const ledgerAccountRepo = new InMemoryLedgerAccountRepository([
      buildAccount({ id: 'pass-1', code: 'PASSIVO', kind: 'liability', accountRole: 'grouping', isSystem: true }),
      buildAccount({ id: 'obr-1', code: 'PASSIVO:OBRIGACOES', kind: 'liability', accountRole: 'grouping', parentLedgerAccountId: 'pass-1' }),
      buildAccount({ id: 'forn-1', code: 'PASSIVO:OBRIGACOES:FORNECEDORES', kind: 'liability', accountRole: 'posting', parentLedgerAccountId: 'obr-1' }),
    ]);

    const ledgerEntryRepo = new InMemoryLedgerEntryRepository([]);
    const useCase = new GetChartOfAccountsSetupUseCase(
      controlCenterRepo,
      ledgerAccountRepo,
      ledgerEntryRepo,
    );

    const setup = await useCase.execute('u-1');
    const passivoRoot = setup.roots.find((root) => root.code === 'PASSIVO');

    expect(passivoRoot?.nodeType).toBe('root');
    expect(passivoRoot?.children[0].nodeType).toBe('grouping');
    expect(passivoRoot?.children[0].capabilities.canCreateChild).toBe(true);
    expect(passivoRoot?.children[0].children[0].nodeType).toBe('leaf');
    expect(passivoRoot?.children[0].children[0].capabilities.canCreateChild).toBe(false);
  });
});
