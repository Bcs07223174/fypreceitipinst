import { getDoctorLookupKeys, getScheduleLookupKeys, normalizeDoctorKey } from './normalizeDoctorKey';

export function resolveDoctorSchedule({ selectedDoctorId, doctors, schedules }: { selectedDoctorId: unknown; doctors: Array<Record<string, unknown>>; schedules: any[]; }) {
  const selectedDoctorKeys = [normalizeDoctorKey(selectedDoctorId)];
  const selectedDoctor = doctors.find((doctor) => getDoctorLookupKeys(doctor).some((key) => selectedDoctorKeys.includes(key))) || null;
  const lookupKeys = selectedDoctor ? getDoctorLookupKeys(selectedDoctor) : selectedDoctorKeys;

  const matchedSchedule = schedules.find((schedule) => {
    const scheduleKeys = getScheduleLookupKeys(schedule);
    return scheduleKeys.some((key) => lookupKeys.includes(key));
  }) || null;

  if (!matchedSchedule) {
    console.warn('[appointments] No schedule matched doctor selection', {
      selectedDoctorId,
      selectedDoctorKeys: lookupKeys,
      availableScheduleKeys: schedules.flatMap((schedule) => getScheduleLookupKeys(schedule)),
      availableSchedules: schedules.length,
    });
  }

  return matchedSchedule;
}
