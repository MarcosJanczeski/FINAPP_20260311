import type {
  PlanningEventSourceItem,
  PlanningEventSourceProvider,
} from './PlanningEventSourceProvider';
import type { ID } from '../../domain/types/common';

export class NoopRecurrencePlanningEventSourceProvider implements PlanningEventSourceProvider {
  async list(_controlCenterId: ID): Promise<PlanningEventSourceItem[]> {
    return [];
  }
}

export class NoopBudgetMarginPlanningEventSourceProvider implements PlanningEventSourceProvider {
  async list(_controlCenterId: ID): Promise<PlanningEventSourceItem[]> {
    return [];
  }
}
