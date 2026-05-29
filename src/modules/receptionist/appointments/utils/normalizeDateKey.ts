import { formatDate, safeParseDate } from '@/lib/utils/date';

export function normalizeDateKey(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const parsed = safeParseDate(raw);
  if (parsed) return formatDate(parsed, 'yyyy-MM-dd');

  return raw.toLowerCase();
}

export function getWeekdayKey(value: unknown) {
  const parsed = safeParseDate(String(value ?? ''));
  return parsed ? formatDate(parsed, 'EEEE') : String(value ?? '').trim().toLowerCase();
}
