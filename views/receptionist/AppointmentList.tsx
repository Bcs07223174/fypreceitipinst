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
import { UserProfile, Appointment, AppointmentStatus, DoctorProfile } from '../../types';
import { getReceptionistProfile, getAppointmentsByDate, updateAppointmentStatus, getAssignedDoctors } from '../../services/clinicService';
import { format, addDays, parseISO } from 'date-fns';

interface AppointmentListProps {
  profile: UserProfile | null;
}

export default function AppointmentList({ profile }: AppointmentListProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('all');
  const [assignedDoctorIds, setAssignedDoctorIds] = useState<string[]>([]);

  const [keyMessage, setKeyMessage] = useState<{ type: 'success' | 'error' | null; text: string }>({ type: null, text: '' });

  const toDateKey = (value: string) => {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : format(parsed, 'yyyy-MM-dd');
  };

  const normalizeDoctorId = (value: string | number | null | undefined) => String(value ?? '').trim().replace(/_/g, '-').toLowerCase();
  const getAppointmentDate = (app: Appointment) => app.appointmentDate || app.date || '';
  const getAppointmentTime = (app: Appointment) => app.appointmentTime || app.slotStartTime || '';

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let mounted = true;

    const stopWithError = (message: string) => {
      if (!mounted) return;
      setAppointments([]);
      setDoctors([]);
      setError(message);
      setLoading(false);
    };

    setLoading(true);
    setError(null);

    if (!profile) {
      stopWithError('Unable to load appointments. Receptionist profile is missing.');
      return () => {
        mounted = false;
      };
    }

    (async () => {
      try {
        const rec = await getReceptionistProfile(profile.clinicId, profile.uid);
        if (!mounted) return;

        if (!rec?.clinicId) {
          stopWithError('Unable to load appointments. Receptionist profile is missing clinic information.');
          return;
        }

        if (rec.assignedDoctorIds.length === 0) {
          setDoctors([]);
        }

        const assigned = rec?.assignedDoctorIds || [];
        if (mounted) setAssignedDoctorIds(assigned);

        // populate doctors list from assigned ids
        try {
          const docs = await getAssignedDoctors(profile.clinicId, assigned);
          if (mounted) setDoctors(docs);
        } catch (err) {
          console.error('Failed to load assigned doctors', err);
          if (mounted) {
            setDoctors([]);
            setError('Unable to load assigned doctors. Showing appointments for the selected date.');
          }
        }

        // Decide which doctorIds to pass to RTDB listener:
        // - if a specific doctor is selected, query only that doctor
        // - if 'all' is selected, use assigned doctors when available; otherwise fall back to all clinic appointments
        const doctorIdsToQuery = selectedDoctorId !== 'all'
          ? [selectedDoctorId]
          : assigned.length > 0
            ? assigned
            : [];

        // Listen for the selected yyyy-MM-dd date and adjacent days for safe timezone/index overlap handling.
        const mergedById = new Map<string, Appointment>();
        const dateCandidates = [
          date,
          format(addDays(parseISO(date), -1), 'yyyy-MM-dd'),
          format(addDays(parseISO(date), 1), 'yyyy-MM-dd')
        ];

        const listeners: Array<() => void> = [];

        const handleDataForDate = (items: Appointment[]) => {
          if (!mounted) return;
          items.forEach((it) => mergedById.set(it.id, it));
          setAppointments(Array.from(mergedById.values()));
          setLoading(false);
        };

        dateCandidates.forEach((d) => {
          const u = getAppointmentsByDate(profile.clinicId, d, doctorIdsToQuery, (data) => {
            // Log each incoming batch
            console.debug('[appointments listener]', {
              selectedDoctorId,
              assignedDoctorIds: assigned,
              listenerDate: d,
              received: data.length,
            });
            handleDataForDate(data);
          });
          listeners.push(u);
        });

        unsub = () => {
          listeners.forEach((off) => off && off());
        };
      } catch (error) {
        console.error('Error initializing appointments listener', error);
        setDoctors([]);
        setAppointments([]);
        setError('Unable to load appointments. Please try again.');
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      if (unsub) unsub();
    };
  }, [profile, date, selectedDoctorId]);

  const selectedDateKey = toDateKey(date);
  const rawAppointments = appointments;
  const afterDateFilter = rawAppointments.filter((app) => toDateKey(getAppointmentDate(app)) === selectedDateKey);
  const afterAssignedFilter = afterDateFilter.filter((app) => {
    if (selectedDoctorId !== 'all') {
      return normalizeDoctorId(app.doctorId) === normalizeDoctorId(selectedDoctorId);
    }

    if (assignedDoctorIds.length === 0) {
      return true;
    }

    return assignedDoctorIds.some((doctorId) => normalizeDoctorId(doctorId) === normalizeDoctorId(app.doctorId));
  });

  const afterStatusFilter = afterAssignedFilter.filter(app => {
    const q = search.trim().toLowerCase();
    const matchesSearch = q === '' || [
      app.patientName,
      app.doctorName,
      app.doctorId,
      app.appointmentKey,
      getAppointmentDate(app),
      getAppointmentTime(app),
    ].some(value => normalizeDoctorId(value).includes(q));
    const matchesStatus = statusFilter === 'all' || (app.status || '').toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const afterPaymentFilter = afterStatusFilter.filter(app => {
    return paymentFilter === 'all' || ((app.paymentStatus || 'pending').toLowerCase() === paymentFilter.toLowerCase());
  });

  const finalFiltered = afterPaymentFilter.filter(app => {
    const q = search.trim().toLowerCase();
    const matchesSearch = q === '' || [
      app.patientName,
      app.doctorName,
      app.doctorId,
      app.appointmentKey,
      getAppointmentDate(app),
      getAppointmentTime(app),
    ].some(value => normalizeDoctorId(value).includes(q));

    const matchesDoctor = selectedDoctorId === 'all' || normalizeDoctorId(app.doctorId) === normalizeDoctorId(selectedDoctorId);
    return matchesSearch && matchesDoctor;
  });

  const selectedDateLabel = format(parseISO(date), 'PPPP');
  const hasAssignedDoctors = assignedDoctorIds.length > 0;
  const hasActiveFilters = search.trim() !== '' || statusFilter !== 'all' || paymentFilter !== 'all' || selectedDoctorId !== 'all';
  const isBusy = loading && !error;

  // Debug logs required by product
  console.debug('Selected date:', selectedDateKey);
  console.debug('Appointment dates:', rawAppointments.map(a => a.date));
  console.debug('Raw appointments before filters:', rawAppointments);
  console.debug('Receptionist profile:', profile);
  console.debug('Assigned doctor IDs:', assignedDoctorIds);
  console.debug('Appointment doctor IDs:', rawAppointments.map(a => a.doctorId));
  console.debug('Current clinicId:', profile?.clinicId);
  console.debug('Appointment clinicIds:', rawAppointments.map(a => a.clinicId));
  console.debug('Raw count:', rawAppointments.length);
  console.debug('After date filter:', afterDateFilter.length);
  console.debug('After assigned doctors filter:', afterAssignedFilter.length);
  console.debug('After status filter:', afterStatusFilter.length);
  console.debug('After payment filter:', afterPaymentFilter.length);
  console.debug('After search filter:', finalFiltered.length);

  const handleStatusChange = async (appointment: Appointment, status: AppointmentStatus) => {
    if (!profile) return;
    try {
      await updateAppointmentStatus(profile.clinicId, appointment.id, appointment, status);
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

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Per-row Key column used for payment confirmation; global input removed */}
      {/* Filters Bar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by patient, doctor, date, or time..." 
            className="w-full rounded-xl bg-slate-50 py-2 pl-10 pr-4 text-sm outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="text-slate-400" size={18} />
          <span className="text-xs font-semibold text-slate-500">Linked Doctor</span>
          <select
            className="rounded-xl bg-slate-50 px-4 py-2 text-sm outline-none"
            value={selectedDoctorId}
            onChange={(e) => setSelectedDoctorId(e.target.value)}
          >
            <option value="all">All Doctors</option>
            {doctors.map(d => (
              <option key={d.uid} value={d.uid}>{d.fullName}</option>
            ))}
          </select>
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
          <select 
            className="rounded-xl bg-slate-50 px-4 py-2 text-sm outline-none"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
          >
            <option value="all">All Payments</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-6 py-4">Key</th>
                <th className="px-6 py-4">Patient</th>
                <th className="px-6 py-4">Doctor</th>
                <th className="px-6 py-4">Time Slot</th>
                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Payment</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isBusy ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-200 border-t-sky-500" />
                      <p className="text-sm font-medium">Loading appointments...</p>
                    </div>
                  </td>
                </tr>
              ) : finalFiltered.map((app) => (
                <tr key={app.id} className="group hover:bg-slate-50/50">
                  <td className="px-6 py-4">
                    <input
                      type="text"
                      defaultValue={app.appointmentKey || ''}
                      placeholder="Enter key"
                      onKeyDown={async (e) => {
                        if (e.key !== 'Enter') return;
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (!val) {
                          setKeyMessage({ type: 'error', text: 'Please enter a key' });
                          return;
                        }
                        const match = val.toLowerCase() === (app.appointmentKey || '').toLowerCase() ||
                          val.toLowerCase() === app.id.toLowerCase() ||
                          app.id.toLowerCase().includes(val.toLowerCase());
                        if (!match) {
                          setKeyMessage({ type: 'error', text: 'Key does not match this booking' });
                          return;
                        }
                        if (!profile) return;
                        try {
                          await updateAppointmentStatus(profile.clinicId, app.id, app, 'confirmed');
                          setKeyMessage({ type: 'success', text: `Payment confirmed for Booking #${app.id.slice(0,8)}` });
                          setTimeout(() => setKeyMessage({ type: null, text: '' }), 3000);
                        } catch (err) {
                          console.error(err);
                          setKeyMessage({ type: 'error', text: 'Failed to confirm payment' });
                        }
                      }}
                      className="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm outline-none border border-slate-200 focus:border-blue-400"
                    />
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
                      <span className="text-sm">
                        {getAppointmentTime(app) || `${app.slotStartTime} - ${app.slotEndTime}`}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                      getStatusColor(app.status)
                    }`}>
                      {app.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                      app.paymentStatus === 'paid'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {app.paymentStatus || 'pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {(() => {
                        const actionEnabled = ['pending', 'booked', 'confirmed'].includes((app.status || '').toLowerCase());
                        return (
                          <>
                       <button 
                        title="Confirm"
                        disabled={!actionEnabled}
                        onClick={() => handleStatusChange(app, 'confirmed')}
                        className="rounded-lg p-1.5 text-green-600 hover:bg-green-50 disabled:opacity-30"
                       >
                         <CheckCircle size={18} />
                       </button>
                       <button 
                        title="Cancel"
                        disabled={!actionEnabled}
                        onClick={() => handleStatusChange(app, 'cancelled')}
                        className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-30"
                       >
                         <XCircle size={18} />
                       </button>
                          </>
                        );
                      })()}
                       <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900">
                         <MoreVertical size={18} />
                       </button>
                    </div>
                  </td>
                </tr>
              ))}
              {finalFiltered.length === 0 && !loading && !error && (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Calendar size={48} className="opacity-20" />
                      {afterDateFilter.length === 0 && hasAssignedDoctors ? (
                        <p className="text-sm font-medium">
                          No appointments found for assigned doctors on {selectedDateLabel}.
                        </p>
                      ) : afterDateFilter.length === 0 ? (
                        <p className="text-sm font-medium">
                          No appointments found for selected date {selectedDateLabel}.
                        </p>
                      ) : afterAssignedFilter.length === 0 ? (
                        <p className="text-sm font-medium">
                          No appointments found for your assigned doctors on {toDateKey(date)}. Check doctor assignment or clear filters.
                        </p>
                      ) : hasActiveFilters ? (
                        <p className="text-sm font-medium">
                          No appointments match the selected date and current filters.
                        </p>
                      ) : (
                        <p className="text-sm font-medium">No appointments found for selected date {selectedDateLabel}.</p>
                      )}
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
