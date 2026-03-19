export function normalizeDocument(value?: string | null): string {
  if (!value) {
    return '';
  }

  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}
