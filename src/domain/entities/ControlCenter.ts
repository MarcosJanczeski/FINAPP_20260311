import type { ID, ISODateString } from '../types/common';

export interface ControlCenter {
  id: ID;
  ownerUserId: ID;
  name: string;
  currency: string;
  createdAt: ISODateString;
}
