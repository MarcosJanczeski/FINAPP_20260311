import type { Account } from '../../domain/entities/Account';
import type { PlanningEvent } from '../../domain/entities/PlanningEvent';
import type { AccountRepository } from '../../domain/repositories/AccountRepository';
import type { LedgerEntryRepository } from '../../domain/repositories/LedgerEntryRepository';
import type { PlanningEventRepository } from '../../domain/repositories/PlanningEventRepository';
import type { ID, ISODateString } from '../../domain/types/common';

interface ProjectionAvailabilitySummary {
  windowStart: ISODateString;
  windowEnd: ISODateString;
  baseBalanceCents: number;
  projectedInflowsCents: number;
  projectedOutflowsCents: number;
  lowestProjectedBalanceCents: number;
  projectedFinalBalanceCents: number;
  consideredEventsCount: number;
}

function firstDayOfCurrentMonthUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 12, 0, 0));
}

function lastDayOfMonthOffsetUtc(offsetMonths: number): Date {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + offsetMonths;
  return new Date(Date.UTC(year, month + 1, 0, 12, 0, 0));
}

function isAvailabilityAccount(account: Account): boolean {
  if (account.status !== 'active' || account.nature !== 'asset') {
    return false;
  }

  return (
    account.type === 'cash' ||
    account.type === 'checking' ||
    account.type === 'digital' ||
    account.type === 'savings'
  );
}

function getCashFlowDate(event: PlanningEvent): Date {
  return new Date(event.settlementDate ?? event.plannedSettlementDate);
}

function isProjectedEvent(event: PlanningEvent, windowStart: Date, windowEnd: Date): boolean {
  if (event.status !== 'active' && event.status !== 'confirmed') {
    return false;
  }

  if (event.type === 'realizado') {
    return false;
  }

  const date = getCashFlowDate(event);
  return date >= windowStart && date <= windowEnd;
}

export class GetProjectionAvailabilitySummaryUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly ledgerEntryRepository: LedgerEntryRepository,
    private readonly planningEventRepository: PlanningEventRepository,
  ) {}

  async execute(controlCenterId: ID): Promise<ProjectionAvailabilitySummary> {
    const [accounts, ledgerEntries, events] = await Promise.all([
      this.accountRepository.listByControlCenter(controlCenterId),
      this.ledgerEntryRepository.listByControlCenter(controlCenterId),
      this.planningEventRepository.listByControlCenter(controlCenterId),
    ]);

    const windowStart = firstDayOfCurrentMonthUtc();
    const windowEnd = lastDayOfMonthOffsetUtc(3);

    const availabilityLedgerAccountIds = new Set(
      accounts
        .filter((account) => isAvailabilityAccount(account))
        .map((account) => account.ledgerAccountId),
    );

    const baseBalanceCents = ledgerEntries.reduce((entrySum, entry) => {
      const lineImpact = entry.lines.reduce((lineSum, line) => {
        if (!availabilityLedgerAccountIds.has(line.ledgerAccountId)) {
          return lineSum;
        }
        return lineSum + line.debitCents - line.creditCents;
      }, 0);
      return entrySum + lineImpact;
    }, 0);

    const consideredEvents = events.filter((event) => isProjectedEvent(event, windowStart, windowEnd));
    const projectedInflowsCents = consideredEvents
      .filter((event) => event.direction === 'inflow')
      .reduce((sum, event) => sum + event.amountCents, 0);
    const projectedOutflowsCents = consideredEvents
      .filter((event) => event.direction === 'outflow')
      .reduce((sum, event) => sum + event.amountCents, 0);
    const runningBalanceBySettlementDate = [...consideredEvents]
      .sort((a, b) => getCashFlowDate(a).getTime() - getCashFlowDate(b).getTime())
      .reduce(
        (state, event) => {
          const delta = event.direction === 'inflow' ? event.amountCents : -event.amountCents;
          const nextBalance = state.currentBalance + delta;
          return {
            currentBalance: nextBalance,
            lowestBalance: Math.min(state.lowestBalance, nextBalance),
          };
        },
        { currentBalance: baseBalanceCents, lowestBalance: baseBalanceCents },
      );

    return {
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      baseBalanceCents,
      projectedInflowsCents,
      projectedOutflowsCents,
      lowestProjectedBalanceCents: runningBalanceBySettlementDate.lowestBalance,
      projectedFinalBalanceCents: baseBalanceCents + projectedInflowsCents - projectedOutflowsCents,
      consideredEventsCount: consideredEvents.length,
    };
  }
}
