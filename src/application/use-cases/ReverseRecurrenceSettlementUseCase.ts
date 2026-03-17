import type { LedgerEntry } from '../../domain/entities/LedgerEntry';
import type { PlanningEvent } from '../../domain/entities/PlanningEvent';
import type { LedgerEntryRepository } from '../../domain/repositories/LedgerEntryRepository';
import type { PlanningEventRepository } from '../../domain/repositories/PlanningEventRepository';
import type { ID } from '../../domain/types/common';
import { buildReversalLedgerEntry, resolveActiveLedgerLink } from '../services/recurrenceLedgerLifecycle';

interface ReverseRecurrenceSettlementInput {
  id: ID;
  controlCenterId: ID;
  reversedByUserId: ID;
}

export class ReverseRecurrenceSettlementUseCase {
  constructor(
    private readonly planningEventRepository: PlanningEventRepository,
    private readonly ledgerEntryRepository: LedgerEntryRepository,
  ) {}

  async execute(input: ReverseRecurrenceSettlementInput): Promise<PlanningEvent> {
    const event = await this.planningEventRepository.getById(input.id);
    if (!event || event.controlCenterId !== input.controlCenterId) {
      throw new Error('Evento de recorrencia nao encontrado.');
    }
    if (event.isVerified) {
      throw new Error('Evento conferido nao permite estorno de liquidacao.');
    }

    const activeSettlement = await resolveActiveLedgerLink(this.ledgerEntryRepository, {
      event,
      baseRelation: 'settlement',
      reversalRelations: ['settlement_reversal'],
    });
    if (!activeSettlement.link || !activeSettlement.entry) {
      throw new Error('Nao existe liquidacao ativa para estorno.');
    }

    const activeRecognition = await resolveActiveLedgerLink(this.ledgerEntryRepository, {
      event,
      baseRelation: 'recognition',
      reversalRelations: ['recognition_reversal'],
      legacyReversalRelation: 'reversal',
    });
    if (!activeRecognition.link || !activeRecognition.entry) {
      throw new Error('Reconhecimento ativo nao encontrado para retorno ao estado confirmado.');
    }

    const reversalEntry = this.buildSettlementReversalEntry(
      activeSettlement.entry,
      input.reversedByUserId,
    );
    await this.ledgerEntryRepository.save(reversalEntry);

    const now = new Date().toISOString();
    const updated: PlanningEvent = {
      ...event,
      type: 'confirmado_agendado',
      status: 'confirmed',
      settlementDate: null,
      isVerified: false,
      verifiedAt: null,
      verifiedByUserId: null,
      ledgerLinks: [
        ...event.ledgerLinks,
        {
          ledgerEntryId: reversalEntry.id,
          relation: 'settlement_reversal',
          createdAt: now,
        },
      ],
      postedLedgerEntryId: activeRecognition.link.ledgerEntryId,
      updatedAt: now,
    };

    await this.planningEventRepository.save(updated);
    return updated;
  }

  private buildSettlementReversalEntry(settlementEntry: LedgerEntry, reversedByUserId: ID): LedgerEntry {
    return buildReversalLedgerEntry({
      originalEntry: settlementEntry,
      referenceType: 'recurrence_settlement_reversal',
      descriptionPrefix: 'Estorno liquidação recorrencia',
      reason: 'Reversao de liquidacao de recorrencia por estorno',
      createdByUserId: reversedByUserId,
    });
  }
}
