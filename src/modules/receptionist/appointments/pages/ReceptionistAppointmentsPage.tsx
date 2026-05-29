"use client"

import LegacyAppointmentList from '@/views/receptionist/AppointmentList';
import type { UserProfile } from '@/styles/types';

export function ReceptionistAppointmentsPage({ profile }: { profile: UserProfile | null }) {
  return <LegacyAppointmentList profile={profile} />;
}
