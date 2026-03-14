import type { Account } from '../../domain/entities/Account';
import type { PlanningEvent } from '../../domain/entities/PlanningEvent';
import type { AccountRepository } from '../../domain/repositories/AccountRepository';
import type { PlanningEventRepository } from '../../domain/repositories/PlanningEventRepository';
import type { ID, ISODateString } from '../../domain/types/common';

interface ProjectionAvailabilitySummary {
  windowStart: ISODateString;
  windowEnd: ISODateString;
  baseBalanceCents: number;
  projectedInflowsCents: number;
  projectedOutflowsCents: number;
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

  return account.type === 'cash' || account.type === 'checking' || account.type === 'digital';
}

function isProjectedEvent(event: PlanningEvent, windowStart: Date, windowEnd: Date): boolean {
  if (event.status !== 'active' && event.status !== 'confirmed') {
    return false;
  }

  if (event.type === 'realizado') {
    return false;
  }

  const date = new Date(event.dueDate);
  return date >= windowStart && date <= windowEnd;
}

export class GetProjectionAvailabilitySummaryUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly planningEventRepository: PlanningEventRepository,
  ) {}

  async execute(controlCenterId: ID): Promise<ProjectionAvailabilitySummary> {
    const [accounts, events] = await Promise.all([
      this.accountRepository.listByControlCenter(controlCenterId),
      this.planningEventRepository.listByControlCenter(controlCenterId),
    ]);

    const windowStart = firstDayOfCurrentMonthUtc();
    const windowEnd = lastDayOfMonthOffsetUtc(3);

    const baseBalanceCents = accounts
      .filter((account) => isAvailabilityAccount(account))
      .reduce((sum, account) => sum + account.openingBalanceCents, 0);

    const consideredEvents = events.filter((event) => isProjectedEvent(event, windowStart, windowEnd));
    const projectedInflowsCents = consideredEvents
      .filter((event) => event.direction === 'inflow')
      .reduce((sum, event) => sum + event.amountCents, 0);
    const projectedOutflowsCents = consideredEvents
      .filter((event) => event.direction === 'outflow')
      .reduce((sum, event) => sum + event.amountCents, 0);

    return {
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      baseBalanceCents,
      projectedInflowsCents,
      projectedOutflowsCents,
      projectedFinalBalanceCents: baseBalanceCents + projectedInflowsCents - projectedOutflowsCents,
      consideredEventsCount: consideredEvents.length,
    };
  }
}
