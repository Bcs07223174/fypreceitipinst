import { useEffect, useState } from 'react';
import { 
  Calendar, 
  Search, 
  Filter, 
  MoreVertical, 
  CheckCircle, 
  XCircle,
  Clock,
  User,
  ExternalLink
} from 'lucide-react';
import { UserProfile, Appointment, ReceptionistProfile, AppointmentStatus } from '../../types';
import { getReceptionistProfile, getAppointmentsByDate, updateAppointmentStatus } from '../../services/clinicService';
import { format } from 'date-fns';

interface AppointmentListProps {
  profile: UserProfile | null;
}

export default function AppointmentList({ profile }: AppointmentListProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let isMounted = true;

    if (!profile) {
      setAppointments([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setAppointments([]);

    (async () => {
      try {
        const rec = await getReceptionistProfile(profile.clinicId, profile.uid);
        if (!isMounted) return;

        if (!rec) {
          setAppointments([]);
          setError('Unable to load receptionist profile.');
          setLoading(false);
          return;
        }

        const docIds = rec.assignedDoctorIds || [];
        unsub = getAppointmentsByDate(
          profile.clinicId,
          date,
          docIds,
          (data) => {
            if (!isMounted) return;
            setAppointments(data);
            setLoading(false);
          },
          (message) => {
            if (!isMounted) return;
            setError(message);
            setLoading(false);
          }
        );
      } catch (err) {
        console.error(err);
        if (!isMounted) return;
        setAppointments([]);
        setError('Failed to load appointments.');
        setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
      if (unsub) unsub();
    };
  }, [profile, date]);

  const filteredAppointments = appointments.filter(app => {
    const matchesSearch = (app.patientName?.toLowerCase() || '').includes(search.toLowerCase()) || 
                          (app.id?.toLowerCase() || '').includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || (app.status || '').toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const handleStatusChange = async (id: string, status: AppointmentStatus) => {
    if (!profile) return;
    try {
      await updateAppointmentStatus(profile.clinicId, id, status);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Appointments</h1>
          <p className="text-slate-500">Manage all bookings for assigned doctors.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <input 
            type="date" 
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border-none bg-transparent px-3 py-1.5 text-sm font-medium outline-none"
          />
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by patient name or ID..." 
            className="w-full rounded-xl bg-slate-50 py-2 pl-10 pr-4 text-sm outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="text-slate-400" size={18} />
          <select 
            className="rounded-xl bg-slate-50 px-4 py-2 text-sm outline-none"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="booked">Booked</option>
            <option value="confirmed">Confirmed</option>
            <option value="checked_in">Checked In</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {error && (
          <div className="border-b border-red-100 bg-red-50 px-6 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-6 py-4">Booking ID</th>
                <th className="px-6 py-4">Patient</th>
                <th className="px-6 py-4">Doctor</th>
                <th className="px-6 py-4">Time Slot</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Calendar size={32} className="opacity-30 animate-pulse" />
                      <p className="text-sm font-medium">Loading appointments...</p>
                    </div>
                  </td>
                </tr>
              )}
              {filteredAppointments.map((app) => (
                <tr key={app.id} className="group hover:bg-slate-50/50">
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs font-medium text-slate-400">#{app.id.slice(0, 8)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-sky-50 flex items-center justify-center text-sky-600 font-bold text-xs">
                        {app.patientName?.[0] || 'P'}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{app.patientName}</p>
                        <p className="text-xs text-slate-500">{app.patientPhone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-slate-700">{app.doctorName}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Clock size={14} />
                      <span className="text-sm">{app.slotStartTime} - {app.slotEndTime}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                      getStatusColor(app.status)
                    }`}>
                      {app.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                       <button 
                        title="Confirm"
                        disabled={app.status !== 'booked'}
                        onClick={() => handleStatusChange(app.id, 'confirmed')}
                        className="rounded-lg p-1.5 text-green-600 hover:bg-green-50 disabled:opacity-30"
                       >
                         <CheckCircle size={18} />
                       </button>
                       <button 
                        title="Cancel"
                        disabled={['completed', 'cancelled'].includes(app.status)}
                        onClick={() => handleStatusChange(app.id, 'cancelled')}
                        className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-30"
                       >
                         <XCircle size={18} />
                       </button>
                       <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900">
                         <MoreVertical size={18} />
                       </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredAppointments.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Calendar size={48} className="opacity-20" />
                      <p className="text-sm font-medium">No appointments found for this selection.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function getStatusColor(status: string) {
  const s = (status || '').toLowerCase();
  switch (s) {
    case 'pending': return 'bg-amber-50 text-amber-600';
    case 'booked': return 'bg-sky-50 text-sky-600';
    case 'confirmed': return 'bg-indigo-50 text-indigo-600';
    case 'checked_in': return 'bg-yellow-50 text-yellow-600';
    case 'waiting': return 'bg-orange-50 text-orange-600';
    case 'called': return 'bg-purple-50 text-purple-600';
    case 'in_consultation': return 'bg-sky-100 text-sky-700';
    case 'completed': return 'bg-green-50 text-green-600';
    case 'cancelled': 
    case 'rejected': return 'bg-red-50 text-red-600';
    case 'missed': return 'bg-slate-50 text-slate-500';
    default: return 'bg-slate-100 text-slate-600';
  }
}
