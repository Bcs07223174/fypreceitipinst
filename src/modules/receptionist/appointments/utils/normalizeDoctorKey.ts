export function normalizeDoctorKey(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function getDoctorLookupKeys(doctor: Record<string, unknown> | null | undefined) {
  if (!doctor) return [];

  return [
    doctor.id,
    doctor.uid,
    doctor.doctorId,
    doctor.doctor_id,
    doctor.name,
    doctor.fullName,
    doctor.displayName,
    doctor.doctorName,
    doctor.firebaseUid,
  ]
    .filter(Boolean)
    .map((value) => normalizeDoctorKey(value));
}

export function getScheduleLookupKeys(schedule: Record<string, unknown> | null | undefined) {
  if (!schedule) return [];

  return [
    schedule.id,
    schedule.uid,
    schedule.doctorId,
    schedule.doctor_id,
    schedule.name,
    schedule.doctorName,
  ]
    .filter(Boolean)
    .map((value) => normalizeDoctorKey(value));
}
