import type { LedgerEntry } from '../../domain/entities/LedgerEntry';
import type { PlanningEvent } from '../../domain/entities/PlanningEvent';
import type { LedgerEntryRepository } from '../../domain/repositories/LedgerEntryRepository';
import type { PlanningEventRepository } from '../../domain/repositories/PlanningEventRepository';
import type { ID } from '../../domain/types/common';
import { buildReversalLedgerEntry, resolveActiveLedgerLink } from '../services/recurrenceLedgerLifecycle';

interface ReverseRecurrenceConfirmationInput {
  id: ID;
  controlCenterId: ID;
  reversedByUserId: ID;
  targetState?: 'forecast' | 'canceled';
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

    if (event.type !== 'confirmado_agendado' && event.type !== 'realizado') {
      throw new Error('Somente recorrencia confirmada ou realizada pode ser ajustada neste fluxo.');
    }

    const now = new Date().toISOString();
    const targetState = input.targetState ?? 'forecast';
    const newLinks = [...event.ledgerLinks];

    const activeSettlement = await resolveActiveLedgerLink(this.ledgerEntryRepository, {
      event,
      baseRelation: 'settlement',
      reversalRelations: ['settlement_reversal'],
    });
    if (activeSettlement.link && activeSettlement.entry) {
      if (event.isVerified) {
        throw new Error('Evento conferido nao permite estorno de liquidacao.');
      }
      const settlementReversal = this.buildSettlementReversalEntry(
        activeSettlement.entry,
        input.reversedByUserId,
      );
      await this.ledgerEntryRepository.save(settlementReversal);
      newLinks.push({
        ledgerEntryId: settlementReversal.id,
        relation: 'settlement_reversal',
        createdAt: now,
      });
    }

    const activeRecognition = await resolveActiveLedgerLink(this.ledgerEntryRepository, {
      event: {
        ...event,
        ledgerLinks: newLinks,
      },
      baseRelation: 'recognition',
      reversalRelations: ['recognition_reversal'],
      legacyReversalRelation: 'reversal',
    });
    if (!activeRecognition.link || !activeRecognition.entry) {
      throw new Error('Reconhecimento contabil nao encontrado para estorno.');
    }

    if (activeRecognition.entry.controlCenterId !== input.controlCenterId) {
      throw new Error('Lancamento de reconhecimento nao encontrado para estorno.');
    }

    const reversalEntry = this.buildRecognitionReversalEntry(
      activeRecognition.entry,
      input.reversedByUserId,
    );
    await this.ledgerEntryRepository.save(reversalEntry);

    const updated: PlanningEvent = {
      ...event,
      type: targetState === 'canceled' ? 'previsto_recorrencia' : 'previsto_recorrencia',
      status: targetState === 'canceled' ? 'canceled' : 'active',
      settlementDate: null,
      isVerified: false,
      verifiedAt: null,
      verifiedByUserId: null,
      ledgerLinks: [
        ...newLinks,
        {
          ledgerEntryId: reversalEntry.id,
          relation: 'recognition_reversal',
          createdAt: now,
        },
      ],
      postedLedgerEntryId: null,
      updatedAt: now,
    };

    await this.planningEventRepository.save(updated);
    return updated;
  }

  private buildRecognitionReversalEntry(recognitionEntry: LedgerEntry, reversedByUserId: ID): LedgerEntry {
    return buildReversalLedgerEntry({
      originalEntry: recognitionEntry,
      referenceType: 'recurrence_reversal',
      descriptionPrefix: 'Estorno reconhecimento recorrencia',
      reason: 'Reversao de confirmacao de recorrencia por estorno',
      createdByUserId: reversedByUserId,
    });
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
