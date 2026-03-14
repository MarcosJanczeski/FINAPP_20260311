import type { LedgerEntry } from '../../domain/entities/LedgerEntry';
import type { PlanningEvent } from '../../domain/entities/PlanningEvent';
import type { LedgerEntryRepository } from '../../domain/repositories/LedgerEntryRepository';
import type { PlanningEventRepository } from '../../domain/repositories/PlanningEventRepository';
import type { ID } from '../../domain/types/common';

interface ReverseRecurrenceConfirmationInput {
  id: ID;
  controlCenterId: ID;
  reversedByUserId: ID;
}

export class ReverseRecurrenceConfirmationUseCase {
  constructor(
    private readonly planningEventRepository: PlanningEventRepository,
    private readonly ledgerEntryRepository: LedgerEntryRepository,
  ) {}

  async execute(input: ReverseRecurrenceConfirmationInput): Promise<PlanningEvent> {
    const event = await this.planningEventRepository.getById(input.id);
    if (!event || event.controlCenterId !== input.controlCenterId) {
      throw new Error('Evento de recorrencia nao encontrado.');
    }

    if (event.type !== 'confirmado_agendado' || event.status !== 'confirmed') {
      throw new Error('Somente recorrencia confirmada pode ser revertida.');
    }

    const recognitionLink = event.ledgerLinks.find((link) => link.relation === 'recognition');
    if (!recognitionLink) {
      throw new Error('Reconhecimento contabil nao encontrado para estorno.');
    }

    const recognitionEntry = await this.ledgerEntryRepository.getById(recognitionLink.ledgerEntryId);
    if (!recognitionEntry || recognitionEntry.controlCenterId !== input.controlCenterId) {
      throw new Error('Lancamento de reconhecimento nao encontrado para estorno.');
    }

    const reversalEntry = this.buildReversalEntry(recognitionEntry, input.reversedByUserId);
    await this.ledgerEntryRepository.save(reversalEntry);

    const updated: PlanningEvent = {
      ...event,
      type: 'previsto_recorrencia',
      status: 'active',
      ledgerLinks: [
        ...event.ledgerLinks,
        {
          ledgerEntryId: reversalEntry.id,
          relation: 'reversal',
          createdAt: new Date().toISOString(),
        },
      ],
      postedLedgerEntryId: null,
      updatedAt: new Date().toISOString(),
    };

    await this.planningEventRepository.save(updated);
    return updated;
  }

  private buildReversalEntry(recognitionEntry: LedgerEntry, reversedByUserId: ID): LedgerEntry {
    const executedAt = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      controlCenterId: recognitionEntry.controlCenterId,
      date: recognitionEntry.date,
      description: `Estorno reconhecimento recorrencia - ${recognitionEntry.description}`,
      referenceType: 'recurrence_reversal',
      referenceId: recognitionEntry.referenceId,
      reversalOf: recognitionEntry.id,
      lines: recognitionEntry.lines.map((line) => ({
        ledgerAccountId: line.ledgerAccountId,
        debitCents: line.creditCents,
        creditCents: line.debitCents,
      })),
      createdByUserId: reversedByUserId,
      reason: 'Reversao de confirmacao de recorrencia por estorno',
      createdAt: executedAt,
    };
  }
}
