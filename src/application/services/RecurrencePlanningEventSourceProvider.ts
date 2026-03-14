import type { Recurrence } from '../../domain/entities/Recurrence';
import type { RecurrenceRepository } from '../../domain/repositories/RecurrenceRepository';
import type { ID } from '../../domain/types/common';
import { buildIsoDateAtNoonUtc } from '../../shared/utils/date';
import type {
  PlanningEventSourceItem,
  PlanningEventSourceProvider,
} from './PlanningEventSourceProvider';

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function buildOccurrenceDate(year: number, monthIndex: number, dayOfMonth: number): string {
  const day = Math.min(dayOfMonth, lastDayOfMonth(year, monthIndex));
  return buildIsoDateAtNoonUtc(year, monthIndex, day);
}

function monthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

export class RecurrencePlanningEventSourceProvider implements PlanningEventSourceProvider {
  constructor(private readonly recurrenceRepository: RecurrenceRepository) {}

  async list(controlCenterId: ID): Promise<PlanningEventSourceItem[]> {
    const recurrences = await this.recurrenceRepository.listByControlCenter(controlCenterId);
    const activeRecurrences = recurrences.filter((recurrence) => recurrence.status === 'active');

    return this.expandMonthlyOccurrences(activeRecurrences);
  }

  private expandMonthlyOccurrences(recurrences: Recurrence[]): PlanningEventSourceItem[] {
    const now = new Date();
    const baseYear = now.getFullYear();
    const baseMonth = now.getMonth();
    const items: PlanningEventSourceItem[] = [];

    for (const recurrence of recurrences) {
      for (let offset = 0; offset <= 3; offset += 1) {
        const monthIndexTotal = baseMonth + offset;
        const year = baseYear + Math.floor(monthIndexTotal / 12);
        const monthIndex = monthIndexTotal % 12;
        const date = buildOccurrenceDate(year, monthIndex, recurrence.dayOfMonth);

        items.push({
          sourceType: 'recurrence',
          sourceId: recurrence.id,
          sourceEventKey: `recurrence:${recurrence.id}:${monthKey(year, monthIndex)}`,
          documentDate: date,
          dueDate: date,
          plannedSettlementDate: date,
          description: recurrence.description,
          type: 'previsto_recorrencia',
          status: 'active',
          direction: recurrence.direction,
          amountCents: recurrence.amountCents,
        });
      }
    }

    return items;
  }
}
