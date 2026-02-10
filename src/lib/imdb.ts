export function formatImdbId(value: unknown): string | null {
  if (value == null) return null;

  let digits = '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    digits = Math.abs(Math.trunc(value)).toString();
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    digits = trimmed.replace(/[^0-9]/g, '');
  } else {
    return null;
  }

  if (!digits) return null;
  const normalizedDigits = digits.padStart(7, '0');
  return `tt${normalizedDigits}`;
}
