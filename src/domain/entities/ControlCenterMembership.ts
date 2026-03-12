import type { ID } from '../types/common';
import type { ControlCenterRole } from '../types/roles';

export interface ControlCenterMembership {
  userId: ID;
  controlCenterId: ID;
  role: ControlCenterRole;
}
