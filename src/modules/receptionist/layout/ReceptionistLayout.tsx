import { Outlet } from 'react-router-dom';
import type { UserProfile } from '@/styles/types';
import { useEffect, useRef, useState } from 'react';
import { listenToAppointmentsByClinic } from '@/services/realtimeDatabaseService';
import { getOpenTabs } from '@/lib/tabStorage';
import { ReceptionistSidebar } from './ReceptionistSidebar';
import { ReceptionistHeader } from './ReceptionistHeader';
import { ReceptionistSavedTabs } from './ReceptionistSavedTabs';
import { ReceptionistMobileNav } from './ReceptionistMobileNav';
import { useAppointmentNotification } from '../appointments/hooks/useAppointmentNotification';

export function ReceptionistLayout({ profile }: { profile: UserProfile | null }) {
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const prevCountRef = useRef<number | null>(null);
  const { hasNewAppointments, setHasNewAppointments } = useAppointmentNotification();

  useEffect(() => {
    setOpenTabs(getOpenTabs());
  }, []);

  useEffect(() => {
    if (!profile) return;

    const unsubscribe = listenToAppointmentsByClinic(profile.clinicId, (appointments) => {
      const count = appointments.length;
      if (prevCountRef.current === null) {
        prevCountRef.current = count;
        return;
      }

      if (count > (prevCountRef.current || 0)) {
        setHasNewAppointments(true);
      }

      prevCountRef.current = count;
    });

    return () => unsubscribe();
  }, [profile, setHasNewAppointments]);

  return (
    <div className="flex min-h-screen bg-slate-50 md:h-screen">
      <ReceptionistSidebar hasNewAppointments={hasNewAppointments} />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <ReceptionistHeader profile={profile} hasNewAppointments={hasNewAppointments} />
        <ReceptionistSavedTabs />

        <div className="flex-1 overflow-y-auto p-4 pb-24 sm:p-6 md:p-8 md:pb-8">
          <Outlet />
        </div>
      </main>

      <ReceptionistMobileNav />
    </div>
  );
}
