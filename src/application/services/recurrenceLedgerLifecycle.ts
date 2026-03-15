import type {
  PlanningEvent,
  PlanningEventLedgerLink,
  PlanningEventLedgerRelation,
} from '../../domain/entities/PlanningEvent';
import type { LedgerEntry } from '../../domain/entities/LedgerEntry';
import type { LedgerEntryRepository } from '../../domain/repositories/LedgerEntryRepository';
import type { ID } from '../../domain/types/common';

interface ResolveActiveLedgerLinkInput {
  event: PlanningEvent;
  baseRelation: PlanningEventLedgerRelation;
  reversalRelations: PlanningEventLedgerRelation[];
  legacyReversalRelation?: PlanningEventLedgerRelation;
}

export async function resolveActiveLedgerLink(
  ledgerEntryRepository: LedgerEntryRepository,
  input: ResolveActiveLedgerLinkInput,
): Promise<{
  link: PlanningEventLedgerLink | null;
  entry: LedgerEntry | null;
}> {
  const baseLinks = input.event.ledgerLinks.filter((link) => link.relation === input.baseRelation);
  if (baseLinks.length === 0) {
    return { link: null, entry: null };
  }

  const acceptedReversalRelations = new Set<PlanningEventLedgerRelation>(input.reversalRelations);
  if (input.legacyReversalRelation) {
    acceptedReversalRelations.add(input.legacyReversalRelation);
  }

  const reversalLinks = input.event.ledgerLinks.filter((link) =>
    acceptedReversalRelations.has(link.relation),
  );
  const entryIds = new Set<string>([
    ...baseLinks.map((link) => link.ledgerEntryId),
    ...reversalLinks.map((link) => link.ledgerEntryId),
  ]);
  const entriesMap = await loadLedgerEntriesById(ledgerEntryRepository, [...entryIds]);

  const reversedIds = new Set<ID>();
  for (const reversalLink of reversalLinks) {
    const reversalEntry = entriesMap.get(reversalLink.ledgerEntryId);
    if (reversalEntry?.reversalOf) {
      reversedIds.add(reversalEntry.reversalOf);
    }
  }

  const activeBaseLinks = baseLinks
    .filter((link) => !reversedIds.has(link.ledgerEntryId))
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));

  if (activeBaseLinks.length === 0) {
    return { link: null, entry: null };
  }

  const activeLink = activeBaseLinks[0];
  return {
    link: activeLink,
    entry: entriesMap.get(activeLink.ledgerEntryId) ?? null,
  };
}

export function buildReversalLedgerEntry(input: {
  originalEntry: LedgerEntry;
  referenceType: LedgerEntry['referenceType'];
  descriptionPrefix: string;
  reason: string;
  createdByUserId: ID;
}): LedgerEntry {
  return {
    id: crypto.randomUUID(),
    controlCenterId: input.originalEntry.controlCenterId,
    date: input.originalEntry.date,
    description: `${input.descriptionPrefix} - ${input.originalEntry.description}`,
    referenceType: input.referenceType,
    referenceId: input.originalEntry.referenceId,
    reversalOf: input.originalEntry.id,
    lines: input.originalEntry.lines.map((line) => ({
      ledgerAccountId: line.ledgerAccountId,
      debitCents: line.creditCents,
      creditCents: line.debitCents,
    })),
    createdByUserId: input.createdByUserId,
    reason: input.reason,
    createdAt: new Date().toISOString(),
  };
}

export function sumLedgerEntryAmountByDebit(entry: LedgerEntry): number {
  return entry.lines.reduce((sum, line) => sum + line.debitCents, 0);
}

async function loadLedgerEntriesById(
  ledgerEntryRepository: LedgerEntryRepository,
  ids: ID[],
): Promise<Map<ID, LedgerEntry>> {
  const entries = await Promise.all(ids.map((id) => ledgerEntryRepository.getById(id)));
  const result = new Map<ID, LedgerEntry>();
  for (const entry of entries) {
    if (entry) {
      result.set(entry.id, entry);
    }
  }
  return result;
}
