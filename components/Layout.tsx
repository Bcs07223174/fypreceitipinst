import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { 
  LayoutDashboard, 
  QrCode, 
  CalendarDays, 
  Users, 
  UserCircle, 
  LogOut,
  Bell,
  Activity
} from 'lucide-react';
import { logout } from '../services/authService';
import { listenToAppointmentsByClinic } from '../services/realtimeDatabaseService';
import { useRef } from 'react';
import { addOpenTab, getOpenTabs, clearOpenTabs } from '../lib/tabStorage';
import { UserProfile } from '../types';

interface LayoutProps {
  profile: UserProfile | null;
}

export default function Layout({ profile }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [hasNewAppointments, setHasNewAppointments] = useState(false);
  const prevCountRef = useRef<number | null>(null);

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
  }, [profile]);

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
                onClick={() => { addOpenTab(item.path); if (item.path === '/appointments') { setHasNewAppointments(false); prevCountRef.current = null; } }}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-sky-50 text-sky-600' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon size={20} />
                <div className="flex items-center gap-2">
                  {item.label}
                  {item.path === '/appointments' && hasNewAppointments && (
                    <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                  )}
                </div>
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
          <h1 className="text-sm font-semibold text-slate-700">Reception Desk</h1>
          <button className="relative rounded-full p-2 text-slate-500 hover:bg-slate-50 transition-colors">
            <Bell size={20} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 border-2 border-white"></span>
          </button>
        </header>

        {/* Saved Tabs Bar */}
        <div className="border-b border-slate-100 bg-white px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {openTabs.length === 0 && (
                <div className="text-sm text-slate-400">No saved tabs</div>
              )}
              {openTabs.map((p) => {
                const nav = navItems.find(n => n.path === p);
                return (
                  <button
                    key={p}
                    onClick={() => navigate(p)}
                    className="rounded-lg bg-slate-50 px-3 py-1 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    {nav ? nav.label : p}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  // attempt to open all saved tabs in new windows; may be blocked
                  const origin = window.location.origin;
                  openTabs.forEach((p, i) => {
                    const url = origin + (p.startsWith('/') ? p : '/' + p);
                    try { window.open(url, '_blank'); } catch (e) { /* ignore */ }
                  });
                }}
                className="text-xs text-slate-500 hover:underline"
              >
                Open all
              </button>
              <button
                onClick={() => { clearOpenTabs(); setOpenTabs([]); }}
                className="text-xs text-slate-500 hover:underline"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

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
              {item.path === '/appointments' && hasNewAppointments && (
                <span className="absolute -mt-7 ml-3 inline-block h-2 w-2 rounded-full bg-red-500 border-2 border-white"></span>
              )}
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
