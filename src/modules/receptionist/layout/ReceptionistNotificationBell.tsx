import { Bell } from 'lucide-react';

export function ReceptionistNotificationBell({ hasNewAppointments }: { hasNewAppointments?: boolean }) {
  return (
    <button className="relative rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-50">
      <Bell size={20} />
      {hasNewAppointments ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" /> : null}
    </button>
  );
}
