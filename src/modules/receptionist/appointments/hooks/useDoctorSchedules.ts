"use client"

import { useEffect, useState } from 'react';
import { getDoctorSchedulesByLinkedDoctorIds } from '@/services/realtimeDatabaseService';

export function useDoctorSchedules(doctorIds: string[]) {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getDoctorSchedulesByLinkedDoctorIds(doctorIds)
      .then((data) => mounted && setSchedules(data))
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, [doctorIds.join('|')]);

  return { schedules, loading };
}
