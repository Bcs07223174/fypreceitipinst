import { Link, useLocation } from 'react-router-dom';
import { Activity, CalendarDays, FileText, LogOut, QrCode, UserCircle, Users } from 'lucide-react';
import { logout } from '@/services/authService';
import { addOpenTab } from '@/lib/tabStorage';

const navItems = [
  { label: 'Dashboard', icon: Activity, path: '/' },
  { label: 'QR Scanner', icon: QrCode, path: '/scan' },
  { label: 'Appointments', icon: CalendarDays, path: '/appointments' },
  { label: 'Patient Booking', icon: FileText, path: '/patient-booking' },
  { label: 'Patient Queue', icon: Users, path: '/queue' },
  { label: 'Profile', icon: UserCircle, path: '/profile' },
];

export function ReceptionistSidebar({ hasNewAppointments }: { hasNewAppointments?: boolean }) {
  const location = useLocation();

  return (
    <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white p-6 md:flex">
      <div className="mb-10 flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500 text-white shadow-md shadow-sky-100">
          <Activity size={24} />
        </div>
        <span className="text-xl font-bold text-slate-900">Medicare</span>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => addOpenTab(item.path)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-sky-50 text-sky-600' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <Icon size={20} />
              <span className="flex items-center gap-2">
                {item.label}
                {item.path === '/appointments' && hasNewAppointments ? <span className="inline-block h-2 w-2 rounded-full bg-red-500" /> : null}
              </span>
            </Link>
          );
        })}
      </nav>

      <button onClick={logout} className="mt-auto flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600">
        <LogOut size={20} />
        Sign Out
      </button>
    </aside>
  );
}
