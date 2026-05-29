import { formatDate, safeParseDate } from '@/lib/utils/date';

export function getAppointmentDateValue(appointment: Record<string, unknown>) {
  return String(appointment.appointmentDate || appointment.date || '').trim();
}

export function getAppointmentDayName(value: unknown) {
  const parsed = safeParseDate(String(value ?? ''));
  return parsed ? formatDate(parsed, 'EEEE') : '';
}
