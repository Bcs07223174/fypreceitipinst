import { getWeekdayKey, normalizeDateKey } from './normalizeDateKey';

type ScheduleDayLike = Record<string, unknown>;

export function resolveScheduleDay({ schedule, selectedDate }: { schedule: { id?: string; days?: ScheduleDayLike[] } | null | undefined; selectedDate: unknown; }) {
  if (!schedule?.days?.length) return null;

  const normalizedSelectedDate = normalizeDateKey(selectedDate);
  const selectedDayName = getWeekdayKey(selectedDate);

  const matched = schedule.days.find((day) => {
    const dateValues = [day.dateOfWeek, day.date, day.scheduleDate, day.label, day.dayOfWeek].map(normalizeDateKey);
    const weekdayValues = [day.dayOfWeek, day.label].map(getWeekdayKey);

    return (
      dateValues.includes(normalizedSelectedDate) ||
      weekdayValues.includes(selectedDayName) ||
      dateValues.some((value) => value.startsWith(normalizedSelectedDate) || normalizedSelectedDate.startsWith(value))
    );
  }) || null;

  if (!matched) {
    console.warn('[appointments] No schedule day matched selected date', {
      scheduleId: schedule.id,
      selectedDate,
      normalizedSelectedDate,
      selectedDayName,
      availableScheduleDays: schedule.days.map((day) => ({
        dateOfWeek: day.dateOfWeek,
        dayOfWeek: day.dayOfWeek,
        date: day.date,
        scheduleDate: day.scheduleDate,
        label: day.label,
      })),
    });
  }

  return matched;
}
