import type { PlanningEvent } from '../../domain/entities/PlanningEvent';
import type { LedgerAccount } from '../../domain/entities/LedgerAccount';
import type { LedgerEntry } from '../../domain/entities/LedgerEntry';
import type { LedgerAccountRepository } from '../../domain/repositories/LedgerAccountRepository';
import type { LedgerEntryRepository } from '../../domain/repositories/LedgerEntryRepository';
import type { PlanningEventRepository } from '../../domain/repositories/PlanningEventRepository';
import type { ID, ISODateString } from '../../domain/types/common';

interface ConfirmRecurrencePlanningEventInput {
  id: ID;
  controlCenterId: ID;
  confirmedByUserId: ID;
  confirmedDate: ISODateString;
  confirmedAmountCents: number;
}

export class ConfirmRecurrencePlanningEventUseCase {
  constructor(
    private readonly planningEventRepository: PlanningEventRepository,
    private readonly ledgerAccountRepository: LedgerAccountRepository,
    private readonly ledgerEntryRepository: LedgerEntryRepository,
  ) {}

  async execute(input: ConfirmRecurrencePlanningEventInput): Promise<PlanningEvent> {
    if (input.confirmedAmountCents < 0) {
      throw new Error('Valor confirmado deve ser maior ou igual a zero.');
    }

    const event = await this.planningEventRepository.getById(input.id);
    if (!event || event.controlCenterId !== input.controlCenterId) {
      throw new Error('Evento de recorrencia nao encontrado.');
    }

    if (event.type !== 'previsto_recorrencia') {
      throw new Error('Somente recorrencia prevista pode ser confirmada neste fluxo.');
    }

    if (event.status !== 'active') {
      throw new Error('Somente recorrencia prevista ativa pode ser confirmada.');
    }

    const recognitionLedgerEntry = await this.buildRecognitionEntry({
      event,
      confirmedAmountCents: input.confirmedAmountCents,
      confirmedDate: input.confirmedDate,
      confirmedByUserId: input.confirmedByUserId,
    });

    await this.ledgerEntryRepository.save(recognitionLedgerEntry);

    const updated: PlanningEvent = {
      ...event,
      type: 'confirmado_agendado',
      status: 'confirmed',
      date: input.confirmedDate,
      amountCents: input.confirmedAmountCents,
      ledgerLinks: [
        ...event.ledgerLinks.filter((link) => link.relation !== 'recognition'),
        {
          ledgerEntryId: recognitionLedgerEntry.id,
          relation: 'recognition',
          createdAt: new Date().toISOString(),
        },
      ],
      postedLedgerEntryId: recognitionLedgerEntry.id,
      updatedAt: new Date().toISOString(),
    };

    await this.planningEventRepository.save(updated);
    return updated;
  }

  private async buildRecognitionEntry(input: {
    event: PlanningEvent;
    confirmedDate: ISODateString;
    confirmedAmountCents: number;
    confirmedByUserId: ID;
  }): Promise<LedgerEntry> {
    const liabilityAccount = await this.ensureSystemLedgerAccount(
      input.event.controlCenterId,
      'PASSIVO:OBRIGACOES',
      'Passivo - Obrigacoes',
      'liability',
    );
    const expenseAccount = await this.ensureSystemLedgerAccount(
      input.event.controlCenterId,
      'DESPESA:OPERACIONAL',
      'Despesa - Operacional',
      'expense',
    );
    const receivableAccount = await this.ensureSystemLedgerAccount(
      input.event.controlCenterId,
      'ATIVO:RECEBIVEIS',
      'Ativo - Recebiveis',
      'asset',
    );
    const revenueAccount = await this.ensureSystemLedgerAccount(
      input.event.controlCenterId,
      'RECEITA:OPERACIONAL',
      'Receita - Operacional',
      'revenue',
    );

    const debitAccount =
      input.event.direction === 'outflow' ? expenseAccount.id : receivableAccount.id;
    const creditAccount =
      input.event.direction === 'outflow' ? liabilityAccount.id : revenueAccount.id;

    return {
      id: crypto.randomUUID(),
      controlCenterId: input.event.controlCenterId,
      date: input.confirmedDate,
      description: `Reconhecimento recorrencia - ${input.event.description}`,
      referenceType: 'recurrence_recognition',
      referenceId: input.event.id,
      lines: [
        {
          ledgerAccountId: debitAccount,
          debitCents: input.confirmedAmountCents,
          creditCents: 0,
        },
        {
          ledgerAccountId: creditAccount,
          debitCents: 0,
          creditCents: input.confirmedAmountCents,
        },
      ],
      createdByUserId: input.confirmedByUserId,
      reason: 'Confirmacao de recorrencia com reconhecimento contabil',
      createdAt: new Date().toISOString(),
    };
  }

  private async ensureSystemLedgerAccount(
    controlCenterId: ID,
    code: string,
    name: string,
    kind: LedgerAccount['kind'],
  ): Promise<LedgerAccount> {
    const existing = await this.ledgerAccountRepository.getByCode(controlCenterId, code);
    if (existing) {
      return existing;
    }

    const created: LedgerAccount = {
      id: crypto.randomUUID(),
      controlCenterId,
      code,
      name,
      kind,
      isSystem: true,
      createdAt: new Date().toISOString(),
    };

    await this.ledgerAccountRepository.save(created);
    return created;
  }
}
