"use client"

import type { UserProfile } from '@/styles/types';
import { ReceptionistQueuePage } from '../../queue/pages/ReceptionistQueuePage';

export function LiveQueueTab({ profile = null }: { profile?: UserProfile | null }) {
  return <ReceptionistQueuePage profile={profile} />;
}
