"use client"

import LegacyQueue from '@/views/receptionist/QueueManagement';
import type { UserProfile } from '@/styles/types';

export function ReceptionistQueuePage({ profile }: { profile: UserProfile | null }) {
  return <LegacyQueue profile={profile} />;
}
