import type { ID, ISODateString } from '../types/common';

export type CounterpartyType = 'person' | 'company' | 'bank' | 'card_issuer' | 'other';
export type CounterpartyStatus = 'active' | 'archived';

export interface Counterparty {
  id: ID;
  controlCenterId: ID;
  name: string;
  document: string | null;
  type: CounterpartyType | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  status: CounterpartyStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
