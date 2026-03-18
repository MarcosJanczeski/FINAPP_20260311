import type { LedgerAccount } from '../../domain/entities/LedgerAccount';
import type { LedgerAccountRepository } from '../../domain/repositories/LedgerAccountRepository';
import type { ID } from '../../domain/types/common';

interface CreateChartOfAccountsNodeInput {
  controlCenterId: ID;
  parentLedgerAccountId: ID;
  name: string;
  accountRole: 'grouping' | 'posting';
}

const ROOT_CODES = new Set(['ATIVO', 'PASSIVO', 'PATRIMONIO_LIQUIDO', 'RECEITAS', 'DESPESAS']);

export class CreateChartOfAccountsNodeUseCase {
  constructor(private readonly ledgerAccountRepository: LedgerAccountRepository) {}

  async execute(input: CreateChartOfAccountsNodeInput): Promise<LedgerAccount> {
    const parent = await this.ledgerAccountRepository.getById(input.parentLedgerAccountId);
    if (!parent || parent.controlCenterId !== input.controlCenterId) {
      throw new Error('Conta pai nao encontrada para este centro de controle.');
    }
    if (parent.accountRole !== 'grouping') {
      throw new Error('Somente conta agrupadora pode receber subcontas.');
    }

    const name = input.name.trim();
    if (!name) {
      throw new Error('Nome da conta e obrigatorio.');
    }

    const code = await this.suggestUniqueCode(input.controlCenterId, parent.code, name);
    const now = new Date().toISOString();
    const created: LedgerAccount = {
      id: crypto.randomUUID(),
      controlCenterId: input.controlCenterId,
      code,
      name,
      kind: parent.kind,
      accountRole: input.accountRole,
      parentLedgerAccountId: parent.id,
      isSystem: false,
      status: 'active',
      createdAt: now,
    };

    await this.ledgerAccountRepository.save(created);
    return created;
  }

  private async suggestUniqueCode(
    controlCenterId: ID,
    parentCode: string,
    accountName: string,
  ): Promise<string> {
    const segment = this.normalizeCodeSegment(accountName);
    const baseCode = `${parentCode}:${segment}`;
    let candidate = baseCode;
    let suffix = 2;

    while (true) {
      const existing = await this.ledgerAccountRepository.getByCode(controlCenterId, candidate);
      if (!existing) {
        return candidate;
      }
      candidate = `${baseCode}_${suffix}`;
      suffix += 1;
    }
  }

  private normalizeCodeSegment(name: string): string {
    const normalized = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    if (normalized.length > 0) {
      return normalized.slice(0, 30);
    }

    return ROOT_CODES.has(name) ? `${name}_ITEM` : 'SUBCONTA';
  }
}
