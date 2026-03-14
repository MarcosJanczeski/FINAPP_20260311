export function formatDatePtBrFromIso(isoDate: string): string {
  const datePart = isoDate.slice(0, 10);
  const [year, month, day] = datePart.split('-');

  if (!year || !month || !day) {
    return isoDate;
  }

  return `${day}/${month}/${year}`;
}

export function isoDateToInputValue(isoDate: string): string {
  return isoDate.slice(0, 10);
}

export function inputValueToIsoDateAtNoonUtc(dateInput: string): string {
  return `${dateInput}T12:00:00.000Z`;
}

export function buildIsoDateAtNoonUtc(year: number, monthIndex: number, day: number): string {
  const month = String(monthIndex + 1).padStart(2, '0');
  const normalizedDay = String(day).padStart(2, '0');
  return `${year}-${month}-${normalizedDay}T12:00:00.000Z`;
}
