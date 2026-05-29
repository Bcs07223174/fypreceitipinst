"use client"

import type { UserProfile } from '@/styles/types';
import { ReceptionistAppointmentsPage } from '../../appointments/pages/ReceptionistAppointmentsPage';

export function AppointmentsTab({ profile = null }: { profile?: UserProfile | null }) {
  return <ReceptionistAppointmentsPage profile={profile} />;
}
