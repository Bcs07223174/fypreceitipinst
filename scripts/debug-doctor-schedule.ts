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

const argv = process.argv.slice(2).filter((value) => value !== '--');
const clinicId = argv[0] || 'demo-clinic-1';
const targetDoctorId = argv[1] || 'all';

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

const printSchedule = (schedule: DoctorScheduleRecord) => {
  console.log(`\nDoctor schedule: ${schedule.doctorId || schedule.doctor_id || schedule.id}`);
  console.log(JSON.stringify(schedule, null, 2));
};

const main = async () => {
  const paths = ['doctor_schedules', 'doctor_schedulesJ'];
  const allSchedules = (
    await Promise.all(paths.map(readSchedulesFromPath))
  ).flat();

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

  console.log(`Found ${clinicFiltered.length} schedule(s) for clinic "${clinicId}" and doctor "${targetDoctorId}".`);
  clinicFiltered.forEach(printSchedule);
};

main().catch((error) => {
  console.error('Doctor schedule debug script failed:', error);
  process.exitCode = 1;
});