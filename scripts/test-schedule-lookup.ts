import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';
import firebaseConfigJson from '../firebase-applet-config.json';

type ScheduleDay = {
  dateOfWeek?: string;
  dayOfWeek?: string;
  morningSlots?: string[];
  eveningSlots?: string[];
  isOffDay?: boolean;
  slotDuration?: string;
};

type DoctorScheduleRecord = {
  id: string;
  doctorId: string;
  doctor_id?: string;
  clinicId?: string;
  weekStart?: string;
  weekEnd?: string;
  totalSlots?: number;
  createdAt?: string;
  updatedAt?: string;
  days: ScheduleDay[];
};

const argv = process.argv.slice(2).filter((v) => v !== '--');
const clinicId = argv[0] || 'demo-clinic-1';
const targetDoctorId = argv[1] || 'all';
const dateKey = argv[2] || new Date().toISOString().slice(0, 10);

const app = initializeApp(firebaseConfigJson as never);
const rtdb = getDatabase(app);

const normalizeDoctorId = (value: string | null | undefined) => String(value ?? '').trim().replace(/_/g, '-').toLowerCase();

const collectLeaves = (node: unknown, path: string[] = []): DoctorScheduleRecord[] => {
  if (!node || typeof node !== 'object') return [];

  const record = node as Record<string, unknown>;
  const hasScheduleShape = Boolean(record.doctorId || record.doctor_id || Array.isArray(record.days));

  if (hasScheduleShape) {
    const rawDays = record.days;
    const days: ScheduleDay[] = Array.isArray(rawDays)
      ? rawDays.map((day) => ({ ...(day as Record<string, unknown> as ScheduleDay) }))
      : rawDays && typeof rawDays === 'object'
        ? Object.entries(rawDays as Record<string, unknown>).map(([key, value]) => ({
            ...(value as Record<string, unknown> as ScheduleDay),
            dateOfWeek: String((value as ScheduleDay)?.dateOfWeek || key || ''),
            dayOfWeek: String((value as ScheduleDay)?.dayOfWeek || key || ''),
          }))
        : [];

    return [{
      id: String(record.id || record.scheduleId || path[path.length - 1] || ''),
      doctorId: String(record.doctorId || record.doctor_id || ''),
      doctor_id: record.doctor_id ? String(record.doctor_id) : String(record.doctorId || ''),
      clinicId: record.clinicId ? String(record.clinicId) : undefined,
      weekStart: record.weekStart ? String(record.weekStart) : undefined,
      weekEnd: record.weekEnd ? String(record.weekEnd) : undefined,
      totalSlots: typeof record.totalSlots === 'number' ? record.totalSlots : Number(record.totalSlots || 0) || undefined,
      createdAt: record.createdAt ? String(record.createdAt) : undefined,
      updatedAt: record.updatedAt ? String(record.updatedAt) : undefined,
      days,
    }];
  }

  return Object.entries(record).flatMap(([childKey, childValue]) =>
    collectLeaves(childValue, [...path, childKey])
  );
};

const readSchedulesFromPath = async (path: string): Promise<DoctorScheduleRecord[]> => {
  const snapshot = await get(ref(rtdb, path));
  if (!snapshot.exists()) return [];
  return collectLeaves(snapshot.val());
};

const weekdayName = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00Z');
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getUTCDay()];
};

const findDayForDate = (schedule: DoctorScheduleRecord, targetDateKey: string): ScheduleDay | null => {
  const weekday = weekdayName(targetDateKey);

  for (const day of schedule.days || []) {
    const dateOfWeek = String(day?.dateOfWeek || '').trim();
    const dayOfWeek = String(day?.dayOfWeek || '').trim();

    if (!dateOfWeek && !dayOfWeek) continue;

    if (dateOfWeek === targetDateKey) return day;
    if (dayOfWeek && dayOfWeek.toLowerCase() === weekday.toLowerCase()) return day;
    if (dateOfWeek && dateOfWeek.startsWith(targetDateKey)) return day;
    if (targetDateKey.startsWith(dateOfWeek)) return day;
  }

  return null;
};

const printResult = (schedule: DoctorScheduleRecord, matchedDay: ScheduleDay | null) => {
  const id = schedule.doctorId || schedule.doctor_id || schedule.id;
  console.log(`\n--- Doctor: ${id} (clinic: ${schedule.clinicId || 'N/A'}) ---`);
  if (!matchedDay) {
    console.log(`No matching day found for date ${dateKey}. Available days: ${JSON.stringify(schedule.days.map((d) => ({ dateOfWeek: d.dateOfWeek, dayOfWeek: d.dayOfWeek })))}`);
    return;
  }

  console.log(`Matched day: ${JSON.stringify({ dateOfWeek: matchedDay.dateOfWeek, dayOfWeek: matchedDay.dayOfWeek })}`);
  console.log(`Morning slots: ${JSON.stringify(matchedDay.morningSlots || [])}`);
  console.log(`Evening slots: ${JSON.stringify(matchedDay.eveningSlots || [])}`);
};

const main = async () => {
  const paths = ['doctor_schedules', 'doctor_schedulesJ'];
  const allSchedules = (await Promise.all(paths.map(readSchedulesFromPath))).flat();

  if (allSchedules.length === 0) {
    console.log(`No schedules found in ${paths.join(' or ')}.`);
    return;
  }

  const filtered = targetDoctorId === 'all'
    ? allSchedules
    : allSchedules.filter((schedule) => {
        const scheduleIds = [schedule.doctorId, schedule.doctor_id].map(normalizeDoctorId);
        return scheduleIds.includes(normalizeDoctorId(targetDoctorId));
      });

  const clinicFiltered = clinicId
    ? filtered.filter((schedule) => !schedule.clinicId || schedule.clinicId === clinicId)
    : filtered;

  if (clinicFiltered.length === 0) {
    console.log(`No schedules found for clinic "${clinicId}" and doctor "${targetDoctorId}".`);
    return;
  }

  console.log(`Found ${clinicFiltered.length} schedule(s) for clinic "${clinicId}" and doctor "${targetDoctorId}". Checking date ${dateKey}...`);

  for (const schedule of clinicFiltered) {
    const matched = findDayForDate(schedule, dateKey);
    printResult(schedule, matched);
  }
};

main().catch((error) => {
  console.error('Schedule lookup test failed:', error);
  process.exitCode = 1;
});
