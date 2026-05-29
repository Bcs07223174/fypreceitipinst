"use client"

import LegacyProfile from '@/views/receptionist/ProfilePage';
import type { UserProfile } from '@/styles/types';

export function ReceptionistProfilePage({ profile }: { profile: UserProfile | null }) {
  return <LegacyProfile profile={profile} />;
}
