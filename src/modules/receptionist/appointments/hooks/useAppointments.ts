"use client"

import { useCallback, useEffect, useState } from 'react';
import { getAppointments } from '../services/appointments.api';

export function useAppointments(clinicId = '', date = '') {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getAppointments(clinicId, date);
      setAppointments(response?.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [clinicId, date]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { appointments, loading, error, refetch };
}
