import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  Play,
  Search,
  Stethoscope,
  Users,
} from 'lucide-react';
import { UserProfile, Appointment, AppointmentStatus, DoctorProfile } from '../../types';
import { listenToClinicPatientQueue, updateAppointmentStatus, getReceptionistProfile, getAssignedDoctors, fetchClinicPatientQueue } from '../../services/clinicService';
import { formatDistanceToNowStrict } from 'date-fns';

interface QueueManagementProps {
  profile: UserProfile | null;
}

export default function QueueManagement({ profile }: QueueManagementProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctorOptions, setDoctorOptions] = useState<DoctorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncState, setSyncState] = useState<'loading' | 'live' | 'snapshot' | 'empty' | 'error'>('loading');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [doctorSearch, setDoctorSearch] = useState('');
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 30000);

    return () => window.clearInterval(timer);
  }, []);

  const normalizeDoctorId = (value: string | number | null | undefined) => String(value ?? '').trim().replace(/_/g, '-').toLowerCase();
  const getDoctorIdentifier = (doctor: DoctorProfile) => doctor.doctorId || doctor.uid;

  const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (value instanceof Date) return value;
    if (typeof value === 'number') return new Date(value);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const normalizeAppointment = (item: Appointment & { appointmentId?: string }, index = 0): Appointment => {
    const queueNumber = typeof item.queueNumber === 'number' ? item.queueNumber : index + 1;
    const appointmentTime = item.appointmentTime || item.slotStartTime || '';
    const slotStartTime = item.slotStartTime || appointmentTime;
    const slotEndTime = item.slotEndTime || '';
    const generatedId = [
      profile?.clinicId || 'clinic',
      item.doctorId || 'doctor',
      item.patientId || 'patient',
      item.date || 'date',
      queueNumber,
    ].join('-');

    return {
      ...item,
      id: item.id || item.appointmentId || generatedId,
      appointmentTime,
      slotStartTime,
      slotEndTime,
      queueNumber,
    };
  };

  const formatAppointmentDate = (app: Appointment) => app.date || app.appointmentDate || 'Today';

  const formatQueueSlot = (app: Appointment) => {
    const start = app.slotStartTime || app.appointmentTime || '';
    const end = app.slotEndTime || '';

    if (start && end && start !== end) {
      return `${start} - ${end}`;
    }

    return start || 'TBD';
  };

  const formatWaitTime = (app: Appointment) => {
    const sourceDate = toDate(app.checkedInAt) || toDate(app.createdAt);

    if (!sourceDate) return 'N/A';

    const minutesElapsed = Math.max(0, Math.floor((nowTick - sourceDate.getTime()) / 60000));

    if (minutesElapsed < 1) return 'Just now';
    if (minutesElapsed < 60) return `${minutesElapsed}m`;

    const hours = Math.floor(minutesElapsed / 60);
    const minutes = minutesElapsed % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  };

  const formatCheckedInAt = (app: Appointment) => {
    const sourceDate = toDate(app.checkedInAt);
    if (!sourceDate) return 'Not checked in';
    return formatDistanceToNowStrict(sourceDate, { addSuffix: true });
  };

  const statusConfig: Record<string, { label: string; wrapper: string; dot: string }> = {
    confirmed: {
      label: 'Confirmed',
      wrapper: 'bg-sky-50 text-sky-700 border-sky-100',
      dot: 'bg-sky-500',
    },
    checked_in: {
      label: 'Checked in',
      wrapper: 'bg-cyan-50 text-cyan-700 border-cyan-100',
      dot: 'bg-cyan-500',
    },
    waiting: {
      label: 'Waiting',
      wrapper: 'bg-amber-50 text-amber-700 border-amber-100',
      dot: 'bg-amber-500',
    },
    called: {
      label: 'Called',
      wrapper: 'bg-orange-50 text-orange-700 border-orange-100',
      dot: 'bg-orange-500',
    },
    in_consultation: {
      label: 'In consultation',
      wrapper: 'bg-violet-50 text-violet-700 border-violet-100',
      dot: 'bg-violet-500',
    },
    completed: {
      label: 'Completed',
      wrapper: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      dot: 'bg-emerald-500',
    },
    cancelled: {
      label: 'Cancelled',
      wrapper: 'bg-rose-50 text-rose-700 border-rose-100',
      dot: 'bg-rose-500',
    },
  };

  const statusMeta = (status?: AppointmentStatus) => statusConfig[status || 'confirmed'] || statusConfig.confirmed;

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let isActive = true;

    const setup = async () => {
      if (!profile) return;

      setLoading(true);
      try {
        const receptionist = await getReceptionistProfile(profile.clinicId, profile.uid);
        const assignedIds = receptionist?.assignedDoctorIds || [];

        if (assignedIds.length) {
          const linkedDoctors = await getAssignedDoctors(profile.clinicId, assignedIds);
          if (isActive) {
            setDoctorOptions(linkedDoctors);
          }
        } else {
          if (isActive) {
            setDoctorOptions([]);
          }
        }
      } catch (error) {
        console.error('Error loading linked doctors:', error);
        if (isActive) {
          setDoctorOptions([]);
        }
      }

      const doctorIdToQuery = doctorFilter !== 'all' ? doctorFilter : 'all';

      const snapshot = await fetchClinicPatientQueue(profile.clinicId, doctorIdToQuery);
      if (!isActive) return;

      const normalizedSnapshot = snapshot.map((item, index) => normalizeAppointment(item, index));
      setAppointments(normalizedSnapshot);
      setSyncState(normalizedSnapshot.length > 0 ? 'snapshot' : 'empty');

      unsub = listenToClinicPatientQueue(profile.clinicId, doctorIdToQuery, '', (data) => {
        if (!isActive) return;

        const queueAppointments = data.map((item, index) => normalizeAppointment({
          id: item.id || item.appointmentId,
          appointmentId: item.appointmentId,
          patientId: item.patientId || '',
          patientName: item.patientName || '',
          patientPhone: item.patientPhone || '',
          doctorId: item.doctorId || '',
          doctorName: item.doctorName || '',
          clinicId: profile.clinicId,
          date: item.date || item.appointmentDate || '',
          appointmentDate: item.appointmentDate || item.date || '',
          appointmentTime: item.appointmentTime || item.slotStartTime || item.slot || '',
          slotStartTime: item.slotStartTime || item.appointmentTime || '',
          slotEndTime: item.slotEndTime || item.appointmentTime || '',
          appointmentKey: item.appointmentKey,
          status: (item.status || 'confirmed') as AppointmentStatus,
          paymentStatus: item.paymentStatus || 'pending',
          qrVerified: true,
          queueNumber: item.queueNumber,
          checkedInAt: item.checkedInAt,
          checkedInBy: item.checkedInBy,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        } as Appointment, index));

        const visibleAppointments = doctorIdToQuery === 'all'
          ? queueAppointments
          : queueAppointments.filter((app) => normalizeDoctorId(app.doctorId) === normalizeDoctorId(doctorIdToQuery));

        const sorted = visibleAppointments
          .map((item, index) => normalizeAppointment(item, index))
          .sort((a, b) => {
            const aQueue = a.queueNumber || 0;
            const bQueue = b.queueNumber || 0;

            if (aQueue !== bQueue) return aQueue - bQueue;

            const aDate = toDate(a.checkedInAt)?.getTime() || toDate(a.createdAt)?.getTime() || 0;
            const bDate = toDate(b.checkedInAt)?.getTime() || toDate(b.createdAt)?.getTime() || 0;
            return aDate - bDate;
          });
        setAppointments(sorted);
        setSyncState(sorted.length > 0 ? 'live' : 'empty');
        setLoading(false);
      });
      setLoading(false);
    };

    setup();

    return () => {
      isActive = false;
      if (unsub) unsub();
    };
  }, [profile, doctorFilter]);

  const filteredAppointments = useMemo(() => {
    const searchValue = doctorSearch.trim().toLowerCase();

    return appointments.filter((app) => {
      const doctorId = (app.doctorId || '').toLowerCase();
      const doctorName = (app.doctorName || '').toLowerCase();
      const patientName = (app.patientName || '').toLowerCase();
      const patientPhone = (app.patientPhone || '').toLowerCase();
      const patientId = (app.patientId || '').toLowerCase();

      return (
        searchValue === '' ||
        doctorId.includes(searchValue) ||
        doctorName.includes(searchValue) ||
        patientName.includes(searchValue) ||
        patientPhone.includes(searchValue) ||
        patientId.includes(searchValue) ||
        String(app.queueNumber || '').includes(searchValue)
      );
    });
  }, [appointments, doctorSearch]);

  const doctorSelectOptions = useMemo(() => {
    if (doctorOptions.length > 0) return doctorOptions;

    return Array.from(new Map(appointments.map((app) => [app.doctorId, app.doctorName || app.doctorId])).entries()).map(([id, name]) => ({
      uid: id,
      fullName: name,
    } as DoctorProfile));
  }, [appointments, doctorOptions]);

  const queueSummary = useMemo(() => {
    const activeStatuses: AppointmentStatus[] = ['confirmed', 'checked_in', 'waiting', 'called', 'in_consultation'];
    const visibleActive = filteredAppointments.filter((app) => activeStatuses.includes(app.status));
    const uniqueDoctors = new Set(visibleActive.map((app) => app.doctorId).filter(Boolean));
    const averageWaitMinutes = visibleActive.length
      ? Math.round(
          visibleActive.reduce((total, app) => {
            const sourceDate = toDate(app.checkedInAt) || toDate(app.createdAt);
            if (!sourceDate) return total;
            return total + Math.max(0, Math.floor((nowTick - sourceDate.getTime()) / 60000));
          }, 0) / visibleActive.length
        )
      : 0;

    return {
      activePatients: visibleActive.length,
      liveDoctors: uniqueDoctors.size,
      averageWaitMinutes,
      totalVisible: filteredAppointments.length,
    };
  }, [filteredAppointments, nowTick]);

  const handleStatusUpdate = async (app: Appointment, status: AppointmentStatus) => {
    if (!profile) return;
    await updateAppointmentStatus(profile.clinicId, app.id, app, status);
  };

  const statusLine = syncState === 'live'
    ? 'Live RTDB sync active'
    : syncState === 'snapshot'
      ? 'Snapshot loaded, waiting for live updates'
      : syncState === 'empty'
        ? 'No patients currently in the queue'
        : syncState === 'error'
          ? 'Queue sync failed'
          : 'Loading live queue';

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-white shadow-2xl shadow-slate-200/70">
        <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-end lg:justify-between lg:p-8">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.3em] text-sky-100">
              <BadgeCheck size={12} />
              Reception Desk
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Live Patient Queue</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Monitor patients in real time, call them forward, and move each visit through the consultation flow without manual refreshes.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-300">Visible patients</p>
              <p className="mt-2 text-3xl font-black">{queueSummary.totalVisible}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-300">Active queue</p>
              <p className="mt-2 text-3xl font-black">{queueSummary.activePatients}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-300">Live doctors</p>
              <p className="mt-2 text-3xl font-black">{queueSummary.liveDoctors}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-300">Avg wait</p>
              <p className="mt-2 text-3xl font-black">{queueSummary.averageWaitMinutes ? `${queueSummary.averageWaitMinutes}m` : 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={doctorSearch}
              onChange={(e) => setDoctorSearch(e.target.value)}
              placeholder="Search patient, doctor, phone, ID, or queue #"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-sky-300 focus:bg-white"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <Clock className="text-slate-400" size={18} />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">Linked doctor</p>
                <select
                  className="mt-1 bg-transparent text-sm font-semibold text-slate-900 outline-none"
                  value={doctorFilter}
                  onChange={(e) => setDoctorFilter(e.target.value)}
                >
                  <option value="all">All doctors</option>
                  {doctorSelectOptions.map((doctor) => (
                    <option key={getDoctorIdentifier(doctor)} value={getDoctorIdentifier(doctor)}>
                      {doctor.fullName || getDoctorIdentifier(doctor)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${syncState === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${syncState === 'live' ? 'bg-emerald-500' : syncState === 'error' ? 'bg-rose-500' : 'bg-sky-500'}`} />
                {statusLine}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Current Queue</h2>
            <p className="text-sm text-slate-500">Patients are sorted by queue number and update automatically when RTDB changes.</p>
          </div>
          <div className="hidden items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500 md:flex">
            <Users size={14} />
            {filteredAppointments.length} shown
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-widest text-slate-500">
              <tr>
                <th className="px-5 py-4">Queue #</th>
                <th className="px-5 py-4">Patient</th>
                <th className="px-5 py-4">Doctor</th>
                <th className="px-5 py-4">Slot</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Wait</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && filteredAppointments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-24 text-center text-slate-400">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-300">
                        <Users size={28} />
                      </div>
                      <p className="text-lg font-semibold text-slate-700">Loading live queue</p>
                      <p className="text-sm leading-6 text-slate-500">We are reading the RTDB feed and the latest patient queue snapshot.</p>
                    </div>
                  </td>
                </tr>
              )}

              {!loading && filteredAppointments.map((app, index) => {
                const meta = statusMeta(app.status);
                const queueNumber = app.queueNumber || index + 1;
                const isActionable = app.status === 'checked_in' || app.status === 'confirmed';

                return (
                  <tr
                    key={app.id || `${app.patientId || 'patient'}-${app.doctorId || 'doctor'}-${queueNumber}-${index}`}
                    className={`align-top transition ${app.status === 'called' ? 'bg-orange-50/40' : app.status === 'in_consultation' ? 'bg-violet-50/40' : ''}`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 min-w-12 items-center justify-center rounded-2xl bg-slate-950 px-3 text-lg font-black text-white shadow-sm">
                          {queueNumber}
                        </div>
                        <div className="hidden text-xs text-slate-500 xl:block">
                          <p className="font-semibold text-slate-700">{formatAppointmentDate(app)}</p>
                          <p>{app.appointmentKey ? `Key ${app.appointmentKey}` : 'Live record'}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-900">{app.patientName || 'Unnamed patient'}</p>
                        <p className="text-xs text-slate-500">Patient ID: {app.patientId || `#${app.id?.slice(-6)?.toUpperCase() || '------'}`}</p>
                        {app.patientPhone && <p className="text-xs text-slate-500">{app.patientPhone}</p>}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{app.doctorName || 'Unassigned doctor'}</p>
                        <p className="text-xs text-slate-500">{app.doctorId || 'No doctor ID'}</p>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="space-y-1 text-sm text-slate-700">
                        <div className="flex items-center gap-2">
                          <CalendarDays size={14} className="text-slate-400" />
                          <span className="font-semibold">{formatAppointmentDate(app)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500">
                          <Clock size={14} className="text-slate-400" />
                          <span>{formatQueueSlot(app)}</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest ${meta.wrapper}`}>
                        <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-600">
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-900">{formatWaitTime(app)}</p>
                        <p className="text-xs text-slate-500">{formatCheckedInAt(app)}</p>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isActionable && (
                          <button
                            onClick={() => handleStatusUpdate(app, 'called')}
                            className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-3 py-2 text-xs font-black text-white shadow-sm transition hover:bg-orange-600 active:scale-[0.98]"
                          >
                            <Play size={14} /> CALL
                          </button>
                        )}
                        {app.status === 'called' && (
                          <button
                            onClick={() => handleStatusUpdate(app, 'in_consultation')}
                            className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-3 py-2 text-xs font-black text-white shadow-sm transition hover:bg-sky-700 active:scale-[0.98]"
                          >
                            <ArrowRight size={14} /> START
                          </button>
                        )}
                        {app.status === 'in_consultation' && (
                          <button
                            onClick={() => handleStatusUpdate(app, 'completed')}
                            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98]"
                          >
                            <CheckCircle2 size={14} /> DONE
                          </button>
                        )}
                        {app.status === 'completed' && (
                          <div className="inline-flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-black uppercase tracking-widest text-emerald-700">
                            <CheckCircle2 size={14} /> Complete
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!loading && filteredAppointments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-24 text-center">
                    <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-slate-400">
                      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-300">
                        <Stethoscope size={30} />
                      </div>
                      <div className="space-y-2">
                        <p className="text-lg font-bold text-slate-700">Queue is currently empty</p>
                        <p className="text-sm leading-6 text-slate-500">
                          The page is already connected to RTDB. When a patient is checked in or their status changes, the queue will update automatically.
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">Flow</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Confirmed patients can be called, moved into consultation, then marked complete from one screen.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">Data</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Queue number, slot time, checked-in timestamp, and doctor assignment are read directly from RTDB records.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">Sync</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">No manual refresh is required. The subscription re-renders automatically when the queue changes.</p>
        </div>
      </div>
    </div>
  );
}
