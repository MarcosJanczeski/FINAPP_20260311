import type {
  PlanningEventDirection,
  PlanningEventStatus,
  PlanningEventType,
} from '../../domain/entities/PlanningEvent';
import type { ID, ISODateString } from '../../domain/types/common';

export interface PlanningEventSourceItem {
  sourceType: 'recurrence' | 'budget_margin' | 'payable' | 'receivable';
  sourceId: ID | null;
  sourceEventKey: string;
  date: ISODateString;
  description: string;
  type: PlanningEventType;
  status: Exclude<PlanningEventStatus, 'posted' | 'canceled'>;
  direction: PlanningEventDirection;
  amountCents: number;
}

export interface PlanningEventSourceProvider {
  list(controlCenterId: ID): Promise<PlanningEventSourceItem[]>;
}
