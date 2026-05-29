"use client"

import { useCallback, useEffect, useState } from 'react';
import { getReceptionistQueue } from '../services/queue.api';

export function useReceptionistQueue(clinicId = '', date = '') {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getReceptionistQueue(clinicId, date);
      setQueue(response?.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [clinicId, date]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { queue, loading, error, refetch };
}
