import { appointmentPatchSchema } from './appointments.schema';
import { deleteAppointmentRecord, getAppointmentById, getAppointmentByKey, listAppointmentsByClinicDate, updateAppointmentRecord } from './appointments.repository';

export async function getAppointmentsService(query: { clinicId?: string; date?: string; }) {
  if (!query.clinicId) {
    return [];
  }

  return listAppointmentsByClinicDate(query.clinicId, query.date);
}

export async function getAppointmentService(clinicId: string, date: string, appointmentId: string) {
  return getAppointmentById(clinicId, date, appointmentId);
}

export async function updateAppointmentService(clinicId: string, date: string, appointmentId: string, rawInput: unknown) {
  const input = appointmentPatchSchema.parse(rawInput);
  await updateAppointmentRecord(clinicId, date, appointmentId, input);
  return getAppointmentById(clinicId, date, appointmentId);
}

export async function deleteAppointmentService(clinicId: string, date: string, appointmentId: string) {
  await deleteAppointmentRecord(clinicId, date, appointmentId);
  return { deleted: true };
}

export async function getAppointmentByKeyService(appointmentKey: string) {
  return getAppointmentByKey(appointmentKey);
}
