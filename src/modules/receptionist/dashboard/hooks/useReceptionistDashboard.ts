"use client"

import { useCallback, useEffect, useState } from 'react';
import { getReceptionistDashboard } from '../services/dashboard.api';
import type { ReceptionistDashboardSummary } from '../types/dashboard.types';

export function useReceptionistDashboard(clinicId = '', date = '') {
  const [data, setData] = useState<ReceptionistDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getReceptionistDashboard(clinicId, date);
      setData(response?.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [clinicId, date]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
