"use client"

import { useEffect, useState } from 'react';

export function useAppointmentNotification() {
  const [hasNewAppointments, setHasNewAppointments] = useState(false);

  useEffect(() => {
    setHasNewAppointments(false);
  }, []);

  return { hasNewAppointments, setHasNewAppointments };
}
