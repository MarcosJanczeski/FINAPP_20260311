import { describe, expect, it } from 'vitest';

import { UpdateChartOfAccountsNodeUseCase } from '../UpdateChartOfAccountsNodeUseCase';
import type { LedgerAccount } from '../../../domain/entities/LedgerAccount';
import type { LedgerAccountRepository } from '../../../domain/repositories/LedgerAccountRepository';

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
}

function buildLedgerAccount(input: Partial<LedgerAccount> & Pick<LedgerAccount, 'id' | 'code'>): LedgerAccount {
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

describe('UpdateChartOfAccountsNodeUseCase', () => {
  it('altera name corretamente', async () => {
    const repo = new InMemoryLedgerAccountRepository([
      buildLedgerAccount({ id: 'n1', code: 'ATIVO:DISPONIBILIDADES:BANCO_X', name: 'Banco X' }),
    ]);

    const useCase = new UpdateChartOfAccountsNodeUseCase(repo);
    const updated = await useCase.execute({
      controlCenterId: 'cc-1',
      ledgerAccountId: 'n1',
      name: 'Banco XPTO',
      status: 'active',
    });

    expect(updated.name).toBe('Banco XPTO');
    expect(updated.code).toBe('ATIVO:DISPONIBILIDADES:BANCO_X');
  });

  it('altera status corretamente', async () => {
    const repo = new InMemoryLedgerAccountRepository([
      buildLedgerAccount({ id: 'n1', code: 'DESPESAS:SERVICOS:AGUA', status: 'active' }),
    ]);

    const useCase = new UpdateChartOfAccountsNodeUseCase(repo);
    const updated = await useCase.execute({
      controlCenterId: 'cc-1',
      ledgerAccountId: 'n1',
      name: 'Água',
      status: 'inactive',
    });

    expect(updated.status).toBe('inactive');
  });

  it('nao altera estrutura nem code', async () => {
    const repo = new InMemoryLedgerAccountRepository([
      buildLedgerAccount({
        id: 'n1',
        code: 'PASSIVO:OBRIGACOES:FORNECEDORES',
        parentLedgerAccountId: 'parent-1',
        kind: 'liability',
        accountRole: 'posting',
      }),
    ]);

    const useCase = new UpdateChartOfAccountsNodeUseCase(repo);
    const updated = await useCase.execute({
      controlCenterId: 'cc-1',
      ledgerAccountId: 'n1',
      name: 'Fornecedores BR',
      status: 'active',
    });

    expect(updated.code).toBe('PASSIVO:OBRIGACOES:FORNECEDORES');
    expect(updated.parentLedgerAccountId).toBe('parent-1');
    expect(updated.kind).toBe('liability');
    expect(updated.accountRole).toBe('posting');
  });

  it('bloqueia edicao de raiz obrigatoria', async () => {
    const repo = new InMemoryLedgerAccountRepository([
      buildLedgerAccount({ id: 'root-1', code: 'ATIVO', accountRole: 'grouping', isSystem: true }),
    ]);

    const useCase = new UpdateChartOfAccountsNodeUseCase(repo);
    await expect(
      useCase.execute({
        controlCenterId: 'cc-1',
        ledgerAccountId: 'root-1',
        name: 'Ativo Editado',
        status: 'active',
      }),
    ).rejects.toThrow('Raiz obrigatoria nao pode ser editada neste fluxo.');
  });

  it('bloqueia edicao de conta de sistema', async () => {
    const repo = new InMemoryLedgerAccountRepository([
      buildLedgerAccount({
        id: 'sys-1',
        code: 'PL:SALDOS_INICIAIS',
        isSystem: true,
        accountRole: 'posting',
        kind: 'equity',
      }),
    ]);

    const useCase = new UpdateChartOfAccountsNodeUseCase(repo);
    await expect(
      useCase.execute({
        controlCenterId: 'cc-1',
        ledgerAccountId: 'sys-1',
        name: 'PL Ajustado',
        status: 'inactive',
      }),
    ).rejects.toThrow('Conta de sistema nao pode ser editada neste fluxo.');
  });
});
