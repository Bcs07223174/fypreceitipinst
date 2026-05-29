import type { UserProfile } from '@/styles/types';
import { ReceptionistNotificationBell } from './ReceptionistNotificationBell';

export function ReceptionistHeader({ profile, hasNewAppointments }: { profile: UserProfile | null; hasNewAppointments?: boolean }) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 md:px-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Reception Desk</p>
        <h1 className="text-sm font-semibold text-slate-700">{profile?.clinicId ? `Clinic ${profile.clinicId}` : 'Medicare'}</h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-right md:block">
          <p className="text-sm font-semibold text-slate-900">{profile?.email || 'Receptionist'}</p>
          <p className="text-xs text-slate-500">{profile?.role || 'receptionist'}</p>
        </div>
        <ReceptionistNotificationBell hasNewAppointments={hasNewAppointments} />
      </div>
    </header>
  );
}
