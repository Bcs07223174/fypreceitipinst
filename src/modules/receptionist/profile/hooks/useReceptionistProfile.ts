"use client"

import { useCallback, useEffect, useState } from 'react';
import { getReceptionistProfile } from '../services/profile.api';

export function useReceptionistProfile() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getReceptionistProfile();
      setProfile(response?.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { profile, loading, error, refetch };
}
