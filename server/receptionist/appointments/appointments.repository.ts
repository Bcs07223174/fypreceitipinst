import { get, ref, remove, serverTimestamp, update } from 'firebase/database';
import { rtdb } from '@/lib/firebase';
import type { AppointmentRecord } from './appointments.types';

const APPOINTMENTS_ROOT = 'appointments';

function stripUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined));
}

export async function listAppointmentsByClinicDate(clinicId: string, date?: string) {
  if (!clinicId) return [];

  const snapshot = await get(ref(rtdb, `${APPOINTMENTS_ROOT}/${clinicId}`));
  const data = snapshot.val() as Record<string, Record<string, AppointmentRecord>> | null;
  if (!data) return [];

  const items = Object.entries(data).flatMap(([dateKey, appointments]) =>
    Object.entries(appointments || {}).map(([appointmentId, appointment]) => ({
      ...appointment,
      id: appointment.id || appointmentId,
      appointmentId: appointment.appointmentId || appointmentId,
      date: appointment.date || dateKey,
      appointmentDate: appointment.appointmentDate || dateKey,
    }))
  );

  return date ? items.filter((item) => String(item.date || item.appointmentDate || '') === String(date)) : items;
}

export async function getAppointmentById(clinicId: string, date: string, appointmentId: string) {
  const snapshot = await get(ref(rtdb, `${APPOINTMENTS_ROOT}/${clinicId}/${date}/${appointmentId}`));
  if (!snapshot.exists()) return null;

  return {
    id: appointmentId,
    appointmentId,
    ...(snapshot.val() as Record<string, unknown>),
  } as AppointmentRecord;
}

export async function getAppointmentByKey(appointmentKey: string) {
  const snapshot = await get(ref(rtdb, `appointmentsByKey/${appointmentKey}`));
  if (!snapshot.exists()) return null;

  return snapshot.val() as { clinicId: string; date: string; appointmentId: string };
}

export async function updateAppointmentRecord(clinicId: string, date: string, appointmentId: string, data: Record<string, unknown>) {
  const appointmentRef = ref(rtdb, `${APPOINTMENTS_ROOT}/${clinicId}/${date}/${appointmentId}`);
  const flatAppointmentRef = ref(rtdb, `${APPOINTMENTS_ROOT}/${appointmentId}`);
  const summaryRef = ref(rtdb, `appointmentSummaries/${clinicId}/${date}/${appointmentId}`);

  const clean = stripUndefined({ ...data, updatedAt: serverTimestamp() });
  await update(appointmentRef, clean);
  await update(flatAppointmentRef, clean);
  await update(summaryRef, clean);
}

export async function deleteAppointmentRecord(clinicId: string, date: string, appointmentId: string) {
  await remove(ref(rtdb, `${APPOINTMENTS_ROOT}/${clinicId}/${date}/${appointmentId}`));
  await remove(ref(rtdb, `${APPOINTMENTS_ROOT}/${appointmentId}`));
  await remove(ref(rtdb, `appointmentSummaries/${clinicId}/${date}/${appointmentId}`));
}
