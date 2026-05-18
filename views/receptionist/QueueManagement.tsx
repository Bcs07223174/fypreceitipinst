import { useEffect, useState } from 'react';
import { 
  Users, 
  MoreVertical, 
  Play, 
  CheckCircle2, 
  UserMinus,
  Clock,
  Search,
  ArrowRight
} from 'lucide-react';
import { UserProfile, Appointment, AppointmentStatus, DoctorProfile } from '../../types';
import { listenToClinicPatientQueue, updateAppointmentStatus, getReceptionistProfile, getAssignedDoctors } from '../../services/clinicService';
import { format } from 'date-fns';

interface QueueManagementProps {
  profile: UserProfile | null;
}

export default function QueueManagement({ profile }: QueueManagementProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctorOptions, setDoctorOptions] = useState<DoctorProfile[]>([]);
  const today = format(new Date(), 'yyyy-MM-dd');
  const [loading, setLoading] = useState(true);
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [doctorSearch, setDoctorSearch] = useState('');

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let isActive = true;

    const setup = async () => {
      if (!profile) return;

      setLoading(true);
      try {
        const receptionist = await getReceptionistProfile(profile.clinicId, profile.uid);
        if (receptionist?.assignedDoctorIds?.length) {
          const linkedDoctors = await getAssignedDoctors(profile.clinicId, receptionist.assignedDoctorIds);
          setDoctorOptions(linkedDoctors);
        } else {
          setDoctorOptions([]);
        }
      } catch (error) {
        console.error('Error loading linked doctors:', error);
        setDoctorOptions([]);
      }

      unsub = listenToClinicPatientQueue(profile.clinicId, 'all', today, (data) => {
        if (!isActive) return;

        const queueAppointments = data.map((item) => ({
          id: item.appointmentId,
          patientId: item.patientId || '',
          patientName: item.patientName || '',
          patientPhone: item.patientPhone || '',
          doctorId: item.doctorId || '',
          doctorName: item.doctorName || '',
          clinicId: profile.clinicId,
          date: item.date || today,
          appointmentDate: item.appointmentDate || item.date || today,
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
        } as Appointment));

        setAppointments(queueAppointments.sort((a, b) => (a.queueNumber || 0) - (b.queueNumber || 0)));
        setLoading(false);
      });
    };

    setup();

    return () => {
      isActive = false;
      if (unsub) unsub();
    };
  }, [profile, today, doctorFilter]);

  const filteredAppointments = appointments.filter((app) => {
    const doctorId = (app.doctorId || '').toLowerCase();
    const doctorName = (app.doctorName || '').toLowerCase();
    const searchValue = doctorSearch.trim().toLowerCase();

    const matchesFilter = doctorFilter === 'all' || doctorId === doctorFilter.toLowerCase();
    const matchesSearch =
      searchValue === '' ||
      doctorId.includes(searchValue) ||
      doctorName.includes(searchValue);

    return matchesFilter && matchesSearch;
  });

  const doctorSelectOptions = doctorOptions.length > 0
    ? doctorOptions
    : Array.from(new Map(appointments.map((app) => [app.doctorId, app.doctorName || app.doctorId])).entries()).map(([id, name]) => ({
        uid: id,
        fullName: name,
      } as DoctorProfile));

  const handleStatusUpdate = async (app: Appointment, status: AppointmentStatus) => {
    if (!profile) return;
    await updateAppointmentStatus(profile.clinicId, app.id, app, status);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Live Client Queue</h1>
          <p className="text-slate-500">Managing patients currently present in the clinic.</p>
        </div>
        <div className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-sky-100">
          {appointments.length} Patients Active
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={doctorSearch}
            onChange={(e) => setDoctorSearch(e.target.value)}
            placeholder="Search doctorId in patientQueue..."
            className="w-full rounded-xl bg-slate-50 py-2 pl-10 pr-4 text-sm outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <Clock className="text-slate-400" size={18} />
          <span className="text-xs font-semibold text-slate-500">Linked Doctor</span>
          <select
            className="rounded-xl bg-slate-50 px-4 py-2 text-sm outline-none"
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value)}
          >
            <option value="all">All Doctors</option>
            {doctorSelectOptions.map((doctor) => (
              <option key={doctor.uid} value={doctor.uid}>
                {doctor.fullName || doctor.uid}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Queue Grid */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
           <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-6 py-4">No.</th>
                <th className="px-6 py-4">Patient</th>
                <th className="px-6 py-4">Doctor</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Wait Time</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAppointments.map((app) => (
                <tr key={app.id} className={`${app.status === 'called' ? 'bg-orange-50/50' : app.status === 'in_consultation' ? 'bg-blue-50/50' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-lg font-bold text-white shadow-sm">
                      {app.queueNumber}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{app.patientName}</p>
                      <p className="text-xs text-slate-400">ID: #{app.id?.slice(-6)?.toUpperCase() || '------'}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-slate-600">{app.doctorName}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${
                        app.status === 'called' ? 'animate-pulse bg-orange-500' : 
                        app.status === 'in_consultation' ? 'bg-sky-500' : 
                        app.status === 'confirmed' ? 'bg-blue-400' : 'bg-green-500'
                      }`}></span>
                      <span className="text-sm font-medium text-slate-700 capitalize">{app.status.replace('_', ' ')}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                     {app.checkedInAt ? format(app.checkedInAt.toDate(), 'hh:mm a') : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {(app.status === 'checked_in' || app.status === 'confirmed') && (
                        <button 
                          onClick={() => handleStatusUpdate(app, 'called')}
                          className="flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-orange-600 transition-all active:scale-95"
                        >
                          <Play size={14} /> CALL
                        </button>
                      )}
                      {app.status === 'called' && (
                        <button 
                          onClick={() => handleStatusUpdate(app, 'in_consultation')}
                          className="flex items-center gap-2 rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-sky-700 transition-all active:scale-95"
                        >
                          <ArrowRight size={14} /> START
                        </button>
                      )}
                      {app.status === 'in_consultation' && (
                        <button 
                          onClick={() => handleStatusUpdate(app, 'completed')}
                          className="flex items-center gap-2 rounded-xl bg-green-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-green-700 transition-all active:scale-95"
                        >
                          <CheckCircle2 size={14} /> DONE
                        </button>
                      )}
                      <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                        <MoreVertical size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
                {filteredAppointments.length === 0 && !loading && (
                <tr>
                   <td colSpan={6} className="py-24 text-center">
                      <div className="flex flex-col items-center gap-3 text-slate-400">
                         <Users size={64} className="opacity-10" />
                         <p className="text-lg font-medium">Queue is currently empty</p>
                         <p className="max-w-xs text-sm">Patients checked in via the QR scanner will appear here automatically.</p>
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
