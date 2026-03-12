import type { ID, ISODateString } from '../types/common';

export type PersonType = 'individual' | 'business';

export interface Person {
  id: ID;
  userId: ID;
  name: string;
  personType: PersonType;
  phone?: string;
  createdAt: ISODateString;
}
