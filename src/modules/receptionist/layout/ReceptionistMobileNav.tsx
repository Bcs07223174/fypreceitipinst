import { Link, useLocation } from 'react-router-dom';
import { Activity, CalendarDays, LogOut, QrCode, Users } from 'lucide-react';
import { logout } from '@/services/authService';

const navItems = [
  { icon: Activity, path: '/' },
  { icon: QrCode, path: '/scan' },
  { icon: CalendarDays, path: '/appointments' },
  { icon: Users, path: '/queue' },
];

export function ReceptionistMobileNav() {
  const location = useLocation();

  return (
    <nav className="fixed inset-x-0 bottom-0 flex h-16 items-center justify-around border-t border-slate-200 bg-white px-4 md:hidden">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <Link key={item.path} to={item.path} className={`rounded-lg p-2 ${isActive ? 'text-sky-600' : 'text-slate-400'}`}>
            <Icon size={20} />
          </Link>
        );
      })}
      <button onClick={logout} className="rounded-lg p-2 text-slate-400">
        <LogOut size={20} />
      </button>
    </nav>
  );
}
