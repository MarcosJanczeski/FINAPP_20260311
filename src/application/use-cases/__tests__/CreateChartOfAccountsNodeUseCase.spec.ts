import { describe, expect, it } from 'vitest';

import { CreateChartOfAccountsNodeUseCase } from '../CreateChartOfAccountsNodeUseCase';
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

describe('CreateChartOfAccountsNodeUseCase', () => {
  it('cria filho quando conta pai e grouping', async () => {
    const repo = new InMemoryLedgerAccountRepository([
      buildLedgerAccount({
        id: 'parent-1',
        code: 'ATIVO:DISPONIBILIDADES',
        accountRole: 'grouping',
        kind: 'asset',
      }),
    ]);

    const useCase = new CreateChartOfAccountsNodeUseCase(repo);

    const created = await useCase.execute({
      controlCenterId: 'cc-1',
      parentLedgerAccountId: 'parent-1',
      name: 'Carteira Local',
      accountRole: 'posting',
    });

    expect(created.parentLedgerAccountId).toBe('parent-1');
    expect(created.code).toBe('ATIVO:DISPONIBILIDADES:CARTEIRA_LOCAL');
    expect(created.accountRole).toBe('posting');
    expect(created.status).toBe('active');

    const saved = await repo.getById(created.id);
    expect(saved?.name).toBe('Carteira Local');
  });

  it('bloqueia criacao em conta posting', async () => {
    const repo = new InMemoryLedgerAccountRepository([
      buildLedgerAccount({
        id: 'posting-parent',
        code: 'ATIVO:DISPONIBILIDADES:CARTEIRA',
        accountRole: 'posting',
      }),
    ]);
    const useCase = new CreateChartOfAccountsNodeUseCase(repo);

    await expect(
      useCase.execute({
        controlCenterId: 'cc-1',
        parentLedgerAccountId: 'posting-parent',
        name: 'Filho inválido',
        accountRole: 'posting',
      }),
    ).rejects.toThrow('Somente conta agrupadora pode receber subcontas.');
  });

  it('normaliza o code a partir do nome', async () => {
    const repo = new InMemoryLedgerAccountRepository([
      buildLedgerAccount({ id: 'parent-1', code: 'DESPESAS:SERVICOS', accountRole: 'grouping', kind: 'expense' }),
    ]);

    const useCase = new CreateChartOfAccountsNodeUseCase(repo);
    const created = await useCase.execute({
      controlCenterId: 'cc-1',
      parentLedgerAccountId: 'parent-1',
      name: 'Água e Esgoto',
      accountRole: 'posting',
    });

    expect(created.code).toBe('DESPESAS:SERVICOS:AGUA_E_ESGOTO');
  });

  it('resolve colisao de code adicionando sufixo incremental', async () => {
    const repo = new InMemoryLedgerAccountRepository([
      buildLedgerAccount({ id: 'parent-1', code: 'RECEITAS:SERVICOS', accountRole: 'grouping', kind: 'revenue' }),
      buildLedgerAccount({ id: 'existing-1', code: 'RECEITAS:SERVICOS:CONSULTORIA', kind: 'revenue' }),
      buildLedgerAccount({ id: 'existing-2', code: 'RECEITAS:SERVICOS:CONSULTORIA_2', kind: 'revenue' }),
    ]);

    const useCase = new CreateChartOfAccountsNodeUseCase(repo);
    const created = await useCase.execute({
      controlCenterId: 'cc-1',
      parentLedgerAccountId: 'parent-1',
      name: 'Consultoria',
      accountRole: 'posting',
    });

    expect(created.code).toBe('RECEITAS:SERVICOS:CONSULTORIA_3');
  });
});
