import type { ID, ISODateString } from '../types/common';

export type CreditCardInvoiceStatus = 'draft' | 'reviewing' | 'conciled';

export interface CreditCardInvoice {
  id: ID;
  controlCenterId: ID;
  creditCardId: ID;
  sourceEventKey: string;
  invoicePeriod: string;
  closingDate: ISODateString;
  dueDate: ISODateString;
  calculatedAmountCents: number;
  finalAmountCents: number;
  itemIds: ID[];
  commitmentId?: ID;
  status: CreditCardInvoiceStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
