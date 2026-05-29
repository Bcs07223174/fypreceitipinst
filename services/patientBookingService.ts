import {
  Timestamp,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export type SlotDisplayStatus = 'available' | 'held' | 'selected_by_me' | 'booked';

export interface PatientDoctor {
  id: string;
  name: string;
  specialization: string;
  doctor_fee: number;
  experience: string;
  education: string;
  clinicName: string;
  location: string;
  rating: number;
  isActive: boolean;
  about: string;
  qualifications: string[];
  photoUrl: string;
}

export interface PatientScheduleDay {
  dayOfWeek: string;
  dateOfWeek?: string;
  morningSlots: string[];
  eveningSlots: string[];
  isOffDay: boolean;
  slotDuration?: string;
}

export interface PatientDoctorSchedule {
  id: string;
  doctorId: string;
  doctor_id?: string;
  days: PatientScheduleDay[];
  weekStart?: string;
  weekEnd?: string;
  totalSlots?: number;
}

export interface SlotLockRecord {
  slotId: string;
  scheduleId: string;
  doctorId: string;
  patientId: string;
  date: string;
  startTime: string;
  status: 'held';
  expiresAt: Timestamp;
  createdAt?: Timestamp;
}

export interface BookedSlotRecord {
  slotId: string;
  scheduleId: string;
  doctorId: string;
  patientId: string;
  appointmentId: string;
  date: string;
  startTime: string;
  status: 'booked';
  createdAt?: Timestamp;
}

export interface ConfirmedPatientBooking {
  appointmentId: string;
  appointmentKey: string;
}

export const DOCTORS_CACHE_KEY = 'doctors_registry';
const HOLD_DURATION_MS = 5 * 60 * 1000;

const normalizeDoctor = (id: string, data: Record<string, any>): PatientDoctor => ({
  id,
  name: String(data.name || data.fullName || data.doctorName || 'Doctor'),
  specialization: String(data.specialization || 'General Physician'),
  doctor_fee: Number(data.doctor_fee || data.fee || 0),
  experience: String(data.experience || 'Available'),
  education: String(data.education || ''),
  clinicName: String(data.clinicName || data.clinic || 'Medicare Clinic'),
  location: String(data.location || data.address || 'Clinic location'),
  rating: Number(data.rating || 4.5),
  isActive: data.isActive !== false && data.status !== 'inactive',
  about: String(data.about || ''),
  qualifications: Array.isArray(data.qualifications) ? data.qualifications.map(String) : [],
  photoUrl: String(data.photoUrl || data.profileImageUrl || ''),
});

const normalizeSchedule = (id: string, data: Record<string, any>): PatientDoctorSchedule => ({
  id,
  doctorId: String(data.doctorId || ''),
  doctor_id: data.doctor_id ? String(data.doctor_id) : undefined,
  weekStart: data.weekStart ? String(data.weekStart) : undefined,
  weekEnd: data.weekEnd ? String(data.weekEnd) : undefined,
  totalSlots: Number(data.totalSlots || 0),
  days: Array.isArray(data.days)
    ? data.days.map((day: Record<string, any>) => ({
        dayOfWeek: String(day.dayOfWeek || ''),
        dateOfWeek: day.dateOfWeek ? String(day.dateOfWeek) : undefined,
        morningSlots: Array.isArray(day.morningSlots) ? day.morningSlots.map(String) : [],
        eveningSlots: Array.isArray(day.eveningSlots) ? day.eveningSlots.map(String) : [],
        isOffDay: Boolean(day.isOffDay),
        slotDuration: day.slotDuration ? String(day.slotDuration) : undefined,
      }))
    : [],
});

const toDateAtMidnight = (date: string) => new Date(`${date}T00:00:00`);

export const makeSlotId = (doctorId: string, date: string, startTime: string) =>
  `${doctorId}_${date}_${startTime.replace(/:/g, '-')}`;

export const getScheduleDay = (schedule: PatientDoctorSchedule, selectedDate: string) => {
  const exactDay = schedule.days.find((day) => day.dateOfWeek === selectedDate);

  if (exactDay) return exactDay;

  const dayName = toDateAtMidnight(selectedDate)
    .toLocaleDateString('en-US', { weekday: 'long' })
    .toLowerCase();

  return schedule.days.find((day) => day.dayOfWeek.toLowerCase() === dayName);
};

export const isSlotInSchedule = (
  schedule: PatientDoctorSchedule,
  date: string,
  startTime: string
) => {
  const day = getScheduleDay(schedule, date);
  if (!day || day.isOffDay) return false;
  return [...day.morningSlots, ...day.eveningSlots].includes(startTime);
};

const assertSlotIsValid = (schedule: PatientDoctorSchedule, date: string, startTime: string) => {
  const day = getScheduleDay(schedule, date);

  if (!day || day.isOffDay || !isSlotInSchedule(schedule, date, startTime)) {
    throw new Error('SLOT_NOT_IN_SCHEDULE');
  }
};

export const loadDoctorsFromCache = (): PatientDoctor[] => {
  if (typeof window === 'undefined') return [];

  try {
    const cached = window.localStorage.getItem(DOCTORS_CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
};

export const fetchActiveDoctors = async (): Promise<PatientDoctor[]> => {
  const snapshot = await getDocs(collection(db, 'doctors'));
  const doctors = snapshot.docs
    .map((doctorDoc) => normalizeDoctor(doctorDoc.id, doctorDoc.data()))
    .filter((doctor) => doctor.isActive);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(DOCTORS_CACHE_KEY, JSON.stringify(doctors));
  }

  return doctors;
};

export const fetchDoctorSchedule = async (doctorId: string): Promise<PatientDoctorSchedule | null> => {
  const primarySnapshot = await getDocs(query(
    collection(db, 'doctor_schedules'),
    where('doctorId', '==', doctorId)
  ));

  const fallbackSnapshot = primarySnapshot.empty
    ? await getDocs(query(collection(db, 'doctor_schedules'), where('doctor_id', '==', doctorId)))
    : null;

  const scheduleDoc = primarySnapshot.docs[0] || fallbackSnapshot?.docs[0];
  return scheduleDoc ? normalizeSchedule(scheduleDoc.id, scheduleDoc.data()) : null;
};

export const listenToBookedSlots = (
  doctorId: string,
  date: string,
  callback: (slots: BookedSlotRecord[]) => void
): Unsubscribe => onSnapshot(
  query(collection(db, 'bookedSlots'), where('doctorId', '==', doctorId), where('date', '==', date)),
  (snapshot) => callback(snapshot.docs.map((slotDoc) => slotDoc.data() as BookedSlotRecord))
);

export const listenToSlotLocks = (
  doctorId: string,
  date: string,
  callback: (locks: SlotLockRecord[]) => void
): Unsubscribe => onSnapshot(
  query(collection(db, 'slotLocks'), where('doctorId', '==', doctorId), where('date', '==', date)),
  (snapshot) => callback(snapshot.docs.map((slotDoc) => slotDoc.data() as SlotLockRecord))
);

export const getSlotDisplayStatus = (
  slotTime: string,
  doctorId: string,
  selectedDate: string,
  currentPatientId: string,
  bookedSlots: BookedSlotRecord[],
  slotLocks: SlotLockRecord[],
  nowMs = Date.now()
): SlotDisplayStatus => {
  const slotId = makeSlotId(doctorId, selectedDate, slotTime);

  if (bookedSlots.some((slot) => slot.slotId === slotId)) {
    return 'booked';
  }

  const lock = slotLocks.find((slotLock) => slotLock.slotId === slotId);
  if (lock && lock.expiresAt.toMillis() > nowMs) {
    return lock.patientId === currentPatientId ? 'selected_by_me' : 'held';
  }

  return 'available';
};

export const holdPatientSlot = async (input: {
  schedule: PatientDoctorSchedule;
  doctorId: string;
  patientId: string;
  date: string;
  startTime: string;
}) => {
  const slotId = makeSlotId(input.doctorId, input.date, input.startTime);
  const lockRef = doc(db, 'slotLocks', slotId);
  const bookedRef = doc(db, 'bookedSlots', slotId);
  const scheduleRef = doc(db, 'doctor_schedules', input.schedule.id);

  await runTransaction(db, async (transaction) => {
    const scheduleSnap = await transaction.get(scheduleRef);
    if (!scheduleSnap.exists()) throw new Error('SCHEDULE_NOT_FOUND');

    const schedule = normalizeSchedule(scheduleSnap.id, scheduleSnap.data());
    assertSlotIsValid(schedule, input.date, input.startTime);

    const bookedSnap = await transaction.get(bookedRef);
    if (bookedSnap.exists()) throw new Error('SLOT_ALREADY_BOOKED');

    const lockSnap = await transaction.get(lockRef);
    const now = Date.now();

    if (lockSnap.exists()) {
      const lock = lockSnap.data() as SlotLockRecord;
      const lockExpiresAt = lock.expiresAt?.toMillis?.() ?? 0;
      if (lockExpiresAt > now && lock.patientId !== input.patientId) {
        throw new Error('SLOT_CURRENTLY_HELD');
      }
    }

    transaction.set(lockRef, {
      slotId,
      scheduleId: input.schedule.id,
      doctorId: input.doctorId,
      patientId: input.patientId,
      date: input.date,
      startTime: input.startTime,
      status: 'held',
      expiresAt: Timestamp.fromMillis(now + HOLD_DURATION_MS),
      createdAt: serverTimestamp(),
    });
  });

  return slotId;
};

export const releasePatientSlot = async (input: {
  doctorId: string;
  patientId: string;
  date: string;
  startTime: string;
}) => {
  const slotId = makeSlotId(input.doctorId, input.date, input.startTime);
  const lockRef = doc(db, 'slotLocks', slotId);

  await runTransaction(db, async (transaction) => {
    const lockSnap = await transaction.get(lockRef);
    if (!lockSnap.exists()) return;

    const lock = lockSnap.data() as SlotLockRecord;
    if (lock.patientId === input.patientId) {
      transaction.delete(lockRef);
    }
  });
};

const createAppointmentId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `appointment_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const createAppointmentKey = (appointmentId: string) => `medicare-${appointmentId}`;

export const confirmPatientBooking = async (input: {
  schedule: PatientDoctorSchedule;
  doctorId: string;
  patientId: string;
  patientName: string;
  date: string;
  startTime: string;
  reason: string;
  paymentStatus: 'pending' | 'paid';
}): Promise<ConfirmedPatientBooking> => {
  const slotId = makeSlotId(input.doctorId, input.date, input.startTime);
  const appointmentId = createAppointmentId();
  const appointmentKey = createAppointmentKey(appointmentId);
  const lockRef = doc(db, 'slotLocks', slotId);
  const bookedRef = doc(db, 'bookedSlots', slotId);
  const appointmentRef = doc(db, 'appointments', appointmentId);
  const scheduleRef = doc(db, 'doctor_schedules', input.schedule.id);

  await runTransaction(db, async (transaction) => {
    const scheduleSnap = await transaction.get(scheduleRef);
    if (!scheduleSnap.exists()) throw new Error('SCHEDULE_NOT_FOUND');

    const schedule = normalizeSchedule(scheduleSnap.id, scheduleSnap.data());
    assertSlotIsValid(schedule, input.date, input.startTime);

    const bookedSnap = await transaction.get(bookedRef);
    if (bookedSnap.exists()) throw new Error('SLOT_ALREADY_BOOKED');

    const lockSnap = await transaction.get(lockRef);
    if (!lockSnap.exists()) throw new Error('LOCK_NOT_FOUND');

    const lock = lockSnap.data() as SlotLockRecord;
    if (lock.patientId !== input.patientId) throw new Error('SLOT_CURRENTLY_HELD');
    if ((lock.expiresAt?.toMillis?.() ?? 0) <= Date.now()) throw new Error('LOCK_EXPIRED');

    transaction.set(bookedRef, {
      slotId,
      scheduleId: input.schedule.id,
      doctorId: input.doctorId,
      patientId: input.patientId,
      appointmentId,
      date: input.date,
      startTime: input.startTime,
      status: 'booked',
      createdAt: serverTimestamp(),
    });

    transaction.set(appointmentRef, {
      appointmentId,
      appointmentKey,
      slotId,
      scheduleId: input.schedule.id,
      doctorId: input.doctorId,
      patientId: input.patientId,
      patientName: input.patientName,
      date: input.date,
      startTime: input.startTime,
      reason: input.reason,
      paymentStatus: input.paymentStatus,
      status: 'booked',
      qrVerified: false,
      createdAt: serverTimestamp(),
    });

    transaction.delete(lockRef);
  });

  return { appointmentId, appointmentKey };
};
