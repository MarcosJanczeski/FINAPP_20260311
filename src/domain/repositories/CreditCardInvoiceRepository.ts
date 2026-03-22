import type { CreditCardInvoice } from '../entities/CreditCardInvoice';
import type { ID } from '../types/common';

export interface CreditCardInvoiceRepository {
  save(invoice: CreditCardInvoice): Promise<void>;
  getById(id: ID): Promise<CreditCardInvoice | null>;
  findByCardAndPeriod(
    controlCenterId: ID,
    creditCardId: ID,
    invoicePeriod: string,
  ): Promise<CreditCardInvoice | null>;
  listByCard(controlCenterId: ID, creditCardId: ID): Promise<CreditCardInvoice[]>;
}
