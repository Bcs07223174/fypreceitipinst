"use client"

import { useMemo, useState } from 'react';

export function useAppointmentFilters() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [payment, setPayment] = useState('all');
  const [doctorId, setDoctorId] = useState('all');

  const filters = useMemo(() => ({ search, status, payment, doctorId }), [search, status, payment, doctorId]);

  return { filters, search, setSearch, status, setStatus, payment, setPayment, doctorId, setDoctorId };
}
