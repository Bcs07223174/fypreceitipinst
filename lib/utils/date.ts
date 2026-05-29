import { format, isValid, parse, parseISO } from 'date-fns';

export function safeParseDate(value: string | Date | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return isValid(value) ? value : null;

  const raw = String(value).trim();
  if (!raw) return null;

  const patterns = ['yyyy-MM-dd', 'MM/dd/yyyy', 'M/d/yyyy', 'dd/MM/yyyy', 'd/M/yyyy', 'yyyy/MM/dd', 'yyyy.MM.dd'];

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const iso = parseISO(raw);
    if (isValid(iso)) return iso;
  }

  for (const pattern of patterns) {
    const parsed = parse(raw, pattern, new Date());
    if (isValid(parsed)) return parsed;
  }

  const fallback = new Date(raw);
  return isValid(fallback) ? fallback : null;
}

export function formatDate(value: string | Date | null | undefined, pattern = 'yyyy-MM-dd') {
  const parsed = safeParseDate(value);
  return parsed ? format(parsed, pattern) : '';
}
