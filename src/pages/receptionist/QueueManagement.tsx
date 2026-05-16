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
import { UserProfile, Appointment, ReceptionistProfile, AppointmentStatus } from '../../types';
import { getReceptionistProfile, getAppointmentsByDate, updateAppointmentStatus } from '../../services/clinicService';
import { format } from 'date-fns';

interface QueueManagementProps {
  profile: UserProfile | null;
}

export default function QueueManagement({ profile }: QueueManagementProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const today = format(new Date(), 'yyyy-MM-dd');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: (() => void) | undefined;

    if (profile) {
      setLoading(true);
      getReceptionistProfile(profile.clinicId, profile.uid).then(rec => {
        if (rec) {
          unsub = getAppointmentsByDate(profile.clinicId, today, rec.assignedDoctorIds, (data) => {
            // Only show patients who are in the clinic (confirmed, checked in, waiting, called, in consultation)
            const queueStatuses: AppointmentStatus[] = ['confirmed', 'checked_in', 'waiting', 'called', 'in_consultation'];
            const inQueue = data.filter(a => queueStatuses.includes(a.status));
            setAppointments(inQueue.sort((a, b) => (a.queueNumber || 0) - (b.queueNumber || 0)));
            setLoading(false);
          });
        } else {
          console.warn('No receptionist profile found for authenticated user.');
          setAppointments([]);
          setLoading(false);
        }
      });
    }

    return () => {
      if (unsub) unsub();
    };
  }, [profile, today]);

  const handleStatusUpdate = async (id: string, status: AppointmentStatus) => {
    if (!profile) return;
    await updateAppointmentStatus(profile.clinicId, id, status);
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
              {appointments.map((app) => (
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
                          onClick={() => handleStatusUpdate(app.id, 'called')}
                          className="flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-orange-600 transition-all active:scale-95"
                        >
                          <Play size={14} /> CALL
                        </button>
                      )}
                      {app.status === 'called' && (
                        <button 
                          onClick={() => handleStatusUpdate(app.id, 'in_consultation')}
                          className="flex items-center gap-2 rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-sky-700 transition-all active:scale-95"
                        >
                          <ArrowRight size={14} /> START
                        </button>
                      )}
                      {app.status === 'in_consultation' && (
                        <button 
                          onClick={() => handleStatusUpdate(app.id, 'completed')}
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
              {appointments.length === 0 && !loading && (
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
