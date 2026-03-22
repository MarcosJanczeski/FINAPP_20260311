import type { CreditCardInvoiceItem } from '../entities/CreditCardInvoiceItem';
import type { ID } from '../types/common';

export interface CreditCardInvoiceItemRepository {
  save(item: CreditCardInvoiceItem): Promise<void>;
  listByInvoice(invoiceId: ID): Promise<CreditCardInvoiceItem[]>;
  findBySourceEventKey(
    controlCenterId: ID,
    sourceEventKey: string,
  ): Promise<CreditCardInvoiceItem | null>;
}
