import type { LedgerEntry } from '../../domain/entities/LedgerEntry';
import type {
  PlanningEvent,
  PlanningEventLedgerRelation,
} from '../../domain/entities/PlanningEvent';
import type { ID } from '../../domain/types/common';

export type PlanningEventOperationalState =
  | 'previsto'
  | 'confirmado'
  | 'realizado'
  | 'cancelado';

export interface PlanningEventOperationalCapabilities {
  isCancelable: boolean;
  isCancelReversible: boolean;
  isVerifiable: boolean;
  canReverseSettlement: boolean;
  canReverseConfirmation: boolean;
  canPostponeSettlement: boolean;
}

export interface PlanningEventOperationalSnapshot {
  state: PlanningEventOperationalState;
  activeLinksCount: {
    recognition: number;
    settlement: number;
  };
  capabilities: PlanningEventOperationalCapabilities;
}

interface ResolvePlanningEventOperationalContext {
  ledgerEntriesById?: Map<ID, LedgerEntry>;
}

export function resolvePlanningEventOperationalSnapshot(
  event: PlanningEvent,
  context: ResolvePlanningEventOperationalContext = {},
): PlanningEventOperationalSnapshot {
  const activeRecognition = countActiveLinks(event, 'recognition', ['recognition_reversal', 'reversal'], context);
  const activeSettlement = countActiveLinks(event, 'settlement', ['settlement_reversal'], context);

  const state = resolveOperationalState(event);
  const capabilities = resolveCapabilities(event, state, {
    activeRecognition,
    activeSettlement,
  });

  return {
    state,
    activeLinksCount: {
      recognition: activeRecognition,
      settlement: activeSettlement,
    },
    capabilities,
  };
}

function resolveOperationalState(event: PlanningEvent): PlanningEventOperationalState {
  if (event.status === 'canceled') {
    return 'cancelado';
  }
  if (event.type === 'realizado') {
    return 'realizado';
  }
  if (event.type === 'confirmado_agendado') {
    return 'confirmado';
  }
  return 'previsto';
}

function resolveCapabilities(
  event: PlanningEvent,
  state: PlanningEventOperationalState,
  input: {
    activeRecognition: number;
    activeSettlement: number;
  },
): PlanningEventOperationalCapabilities {
  const isRecurrence = event.sourceType === 'recurrence';
  const isCancelable =
    isRecurrence &&
    state !== 'cancelado' &&
    !(state === 'realizado' && event.isVerified) &&
    (state === 'previsto' || state === 'confirmado' || state === 'realizado');
  const isCancelReversible = isRecurrence && state === 'cancelado' && event.type === 'previsto_recorrencia';
  const isVerifiable = state === 'realizado';
  const canReverseSettlement = state === 'realizado' && input.activeSettlement > 0 && !event.isVerified;
  const canReverseConfirmation = state === 'confirmado' && input.activeRecognition > 0;
  const canPostponeSettlement =
    state === 'confirmado' && event.status !== 'canceled' && event.sourceType === 'recurrence';

  return {
    isCancelable,
    isCancelReversible,
    isVerifiable,
    canReverseSettlement,
    canReverseConfirmation,
    canPostponeSettlement,
  };
}

function countActiveLinks(
  event: PlanningEvent,
  baseRelation: PlanningEventLedgerRelation,
  reversalRelations: PlanningEventLedgerRelation[],
  context: ResolvePlanningEventOperationalContext,
): number {
  const baseLinks = event.ledgerLinks.filter((link) => link.relation === baseRelation);
  if (baseLinks.length === 0) {
    return 0;
  }

  const reversalLinks = event.ledgerLinks.filter((link) =>
    reversalRelations.includes(link.relation),
  );

  if (!context.ledgerEntriesById) {
    const reversedByCount = reversalLinks.length;
    return Math.max(0, baseLinks.length - reversedByCount);
  }

  const reversedIds = new Set<ID>();
  for (const reversalLink of reversalLinks) {
    const reversalEntry = context.ledgerEntriesById.get(reversalLink.ledgerEntryId);
    if (reversalEntry?.reversalOf) {
      reversedIds.add(reversalEntry.reversalOf);
    }
  }

  return baseLinks.filter((link) => !reversedIds.has(link.ledgerEntryId)).length;
}
