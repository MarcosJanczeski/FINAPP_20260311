import type { ControlCenterMembership } from '../entities/ControlCenterMembership';
import type { ID } from '../types/common';

export interface ControlCenterMembershipRepository {
  listByUser(userId: ID): Promise<ControlCenterMembership[]>;
  listByControlCenter(controlCenterId: ID): Promise<ControlCenterMembership[]>;
  save(membership: ControlCenterMembership): Promise<void>;
}
