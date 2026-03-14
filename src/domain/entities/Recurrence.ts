import type { ID, ISODateString } from '../types/common';
import type { PlanningEventDirection } from './PlanningEvent';

export type RecurrenceFrequency = 'monthly';
export type RecurrenceStatus = 'active' | 'inactive';

export interface Recurrence {
  id: ID;
  controlCenterId: ID;
  description: string;
  frequency: RecurrenceFrequency;
  dayOfMonth: number;
  direction: PlanningEventDirection;
  amountCents: number;
  status: RecurrenceStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
