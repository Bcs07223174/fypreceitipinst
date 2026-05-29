"use client"

import LegacyDashboard from '@/views/receptionist/Dashboard';
import type { UserProfile } from '@/styles/types';

export function ReceptionistDashboardPage({ profile }: { profile: UserProfile | null }) {
  return <LegacyDashboard profile={profile} />;
}
