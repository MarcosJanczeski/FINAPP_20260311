export interface ResolveCreditCardInvoiceCycleInput {
  competenceDate: string;
  closingDay: number;
  dueDay: number;
}

export interface CreditCardInvoiceCycle {
  invoicePeriod: string;
  closingDate: string;
  dueDate: string;
}

function parseIsoDateOrThrow(value: string, field: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} invalida.`);
  }
  return parsed;
}

function assertDayInRange(day: number, field: string): void {
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error(`${field} deve estar entre 1 e 31.`);
  }
}

function daysInUtcMonth(year: number, monthZeroBased: number): number {
  return new Date(Date.UTC(year, monthZeroBased + 1, 0, 12, 0, 0)).getUTCDate();
}

function buildUtcDate(year: number, monthZeroBased: number, day: number): Date {
  const clampedDay = Math.min(day, daysInUtcMonth(year, monthZeroBased));
  return new Date(Date.UTC(year, monthZeroBased, clampedDay, 12, 0, 0));
}

export function resolveCreditCardInvoiceCycle(
  input: ResolveCreditCardInvoiceCycleInput,
): CreditCardInvoiceCycle {
  assertDayInRange(input.closingDay, 'closingDay');
  assertDayInRange(input.dueDay, 'dueDay');

  const competenceDate = parseIsoDateOrThrow(input.competenceDate, 'competenceDate');
  const competenceYear = competenceDate.getUTCFullYear();
  const competenceMonth = competenceDate.getUTCMonth();
  const competenceDay = competenceDate.getUTCDate();

  const closesInCurrentMonth = competenceDay <= input.closingDay;
  const periodMonth = closesInCurrentMonth ? competenceMonth : competenceMonth + 1;
  const periodYear = competenceYear + Math.floor(periodMonth / 12);
  const normalizedPeriodMonth = ((periodMonth % 12) + 12) % 12;

  const closingDate = buildUtcDate(periodYear, normalizedPeriodMonth, input.closingDay);

  const dueMonthOffset = input.dueDay > input.closingDay ? 0 : 1;
  const dueMonth = normalizedPeriodMonth + dueMonthOffset;
  const dueYear = periodYear + Math.floor(dueMonth / 12);
  const normalizedDueMonth = dueMonth % 12;
  const dueDate = buildUtcDate(dueYear, normalizedDueMonth, input.dueDay);

  const periodTextMonth = `${normalizedPeriodMonth + 1}`.padStart(2, '0');
  return {
    invoicePeriod: `${periodYear}-${periodTextMonth}`,
    closingDate: closingDate.toISOString(),
    dueDate: dueDate.toISOString(),
  };
}
