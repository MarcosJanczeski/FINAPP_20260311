import type { ID, ISODateString } from '../types/common';

export type PlanningEventType =
  | 'realizado'
  | 'confirmado_agendado'
  | 'previsto_recorrencia'
  | 'previsto_margem';

export type PlanningEventStatus = 'active' | 'confirmed' | 'canceled' | 'posted';

export type PlanningEventDirection = 'inflow' | 'outflow';

export interface PlanningEvent {
  id: ID;
  controlCenterId: ID;
  date: ISODateString;
  description: string;
  type: PlanningEventType;
  status: PlanningEventStatus;
  direction: PlanningEventDirection;
  amountCents: number;
  sourceType: 'manual' | 'recurrence' | 'budget_margin' | 'payable' | 'receivable' | 'import';
  sourceId: ID | null;
  sourceEventKey: string | null;
  postedLedgerEntryId: ID | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
