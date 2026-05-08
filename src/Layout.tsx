import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  QrCode, 
  CalendarDays, 
  Users, 
  UserCircle, 
  LogOut,
  Bell,
  Search,
  Activity
} from 'lucide-react';
import { logout } from './services/authService';
import { UserProfile } from './types';

interface LayoutProps {
  profile: UserProfile | null;
}

export default function Layout({ profile }: LayoutProps) {
  const location = useLocation();

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { label: 'QR Scanner', icon: QrCode, path: '/scan' },
    { label: 'Appointments', icon: CalendarDays, path: '/appointments' },
    { label: 'Patient Queue', icon: Users, path: '/queue' },
    { label: 'Profile', icon: UserCircle, path: '/profile' },
  ];

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-200 bg-white p-6 hidden md:flex flex-col">
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
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-sky-50 text-sky-600' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon size={20} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={logout}
          className="mt-auto flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut size={20} />
          Sign Out
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 shrink-0">
          <div className="relative w-96 max-w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search booking ID, patient..." 
              className="w-full rounded-lg bg-slate-50 py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="flex items-center gap-4">
            <button className="relative rounded-full p-2 text-slate-500 hover:bg-slate-50 transition-colors">
              <Bell size={20} />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 border-2 border-white"></span>
            </button>
            <div className="h-8 w-px bg-slate-200"></div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900">{profile?.email.split('@')[0]}</p>
                <p className="text-xs font-semibold text-slate-400 capitalize">{profile?.role}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 font-bold border-2 border-white shadow-sm">
                {profile?.email?.[0]?.toUpperCase() || 'U'}
              </div>
            </div>
          </div>
        </header>

        {/* Viewport */}
        <div className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 flex items-center justify-around px-4">
        {navItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center p-2 rounded-lg transition-colors ${
                isActive ? 'text-sky-600' : 'text-slate-400'
              }`}
            >
              <Icon size={20} />
            </Link>
          );
        })}
        <button
          onClick={logout}
          className="flex flex-col items-center justify-center p-2 rounded-lg text-slate-400"
        >
          <LogOut size={20} />
        </button>
      </nav>
    </div>
  );
}
