"use client"

import type { UserProfile } from '@/styles/types';
import { ReceptionistProfilePage } from '../../profile/pages/ReceptionistProfilePage';

export function ProfileTab({ profile = null }: { profile?: UserProfile | null }) {
  return <ReceptionistProfilePage profile={profile} />;
}
