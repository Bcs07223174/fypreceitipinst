"use client"

import LegacyScanner from '@/views/receptionist/QRScannerPage';
import type { UserProfile } from '@/styles/types';

export function ReceptionistQRScannerPage({ profile }: { profile: UserProfile | null }) {
  return <LegacyScanner profile={profile} />;
}
