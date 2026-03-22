import type { ID, ISODateString } from '../types/common';

export interface CreditCardInvoiceItem {
  id: ID;
  controlCenterId: ID;
  creditCardId: ID;
  businessTransactionId?: ID;
  sourceEventKey: string;
  installmentNumber: number;
  installmentCount: number;
  amountCents: number;
  documentDate: ISODateString;
  invoiceId: ID;
  createdAt: ISODateString;
  updatedAt?: ISODateString;
}
