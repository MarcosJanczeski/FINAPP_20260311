import { describe, expect, it } from 'vitest';
import { resolveCreditCardInvoiceCycle } from '../../../domain/services/creditCardInvoiceDomain';

function isoDateFromUtc(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).toISOString();
}

describe('creditCardInvoiceDomain', () => {
  it('compra ate o fechamento (inclusive) cai na fatura corrente', () => {
    const cycle = resolveCreditCardInvoiceCycle({
      competenceDate: isoDateFromUtc(2026, 3, 10),
      closingDay: 10,
      dueDay: 20,
    });

    expect(cycle.invoicePeriod).toBe('2026-03');
    expect(cycle.closingDate).toBe(isoDateFromUtc(2026, 3, 10));
    expect(cycle.dueDate).toBe(isoDateFromUtc(2026, 3, 20));
  });

  it('compra apos fechamento cai na proxima fatura', () => {
    const cycle = resolveCreditCardInvoiceCycle({
      competenceDate: isoDateFromUtc(2026, 3, 11),
      closingDay: 10,
      dueDay: 20,
    });

    expect(cycle.invoicePeriod).toBe('2026-04');
    expect(cycle.closingDate).toBe(isoDateFromUtc(2026, 4, 10));
    expect(cycle.dueDate).toBe(isoDateFromUtc(2026, 4, 20));
  });

  it('trata virada de ano de forma deterministica', () => {
    const cycle = resolveCreditCardInvoiceCycle({
      competenceDate: isoDateFromUtc(2026, 12, 25),
      closingDay: 10,
      dueDay: 20,
    });

    expect(cycle.invoicePeriod).toBe('2027-01');
    expect(cycle.closingDate).toBe(isoDateFromUtc(2027, 1, 10));
    expect(cycle.dueDate).toBe(isoDateFromUtc(2027, 1, 20));
  });
});
