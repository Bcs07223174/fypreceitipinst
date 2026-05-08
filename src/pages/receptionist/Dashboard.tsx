import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Calendar,
  ChevronRight,
  Stethoscope
} from 'lucide-react';
import { UserProfile, DoctorProfile, Appointment, ReceptionistProfile } from '../../types';
import { getReceptionistProfile, getAssignedDoctors, getAppointmentsByDate } from '../../services/clinicService';
import { format } from 'date-fns';

interface DashboardProps {
  profile: UserProfile | null;
}

export default function Dashboard({ profile }: DashboardProps) {
  const [recProfile, setRecProfile] = useState<ReceptionistProfile | null>(null);
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    let unsub: (() => void) | undefined;

    if (profile) {
      getReceptionistProfile(profile.clinicId, profile.uid).then(data => {
        setRecProfile(data);
        const docIds = data?.assignedDoctorIds || [];
        if (docIds.length) {
          getAssignedDoctors(profile.clinicId, docIds).then(setDoctors);
        }
        unsub = getAppointmentsByDate(profile.clinicId, today, docIds, setAppointments);
      });
    }

    return () => {
      if (unsub) unsub();
    };
  }, [profile, today]);

  const stats = [
    { label: 'Total Appointments', value: appointments.length, icon: Calendar, color: 'sky' },
    { label: 'Waiting List', value: appointments.filter(a => ['confirmed', 'checked_in'].includes(a.status)).length, icon: Clock, color: 'orange' },
    { label: 'Completed', value: appointments.filter(a => a.status === 'completed').length, icon: CheckCircle2, color: 'green' },
    { label: 'Cancelled', value: appointments.filter(a => a.status === 'cancelled').length, icon: AlertCircle, color: 'red' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome Back, {recProfile?.fullName || 'Receptionist'}</h1>
        <p className="text-slate-500">Here's what's happening at the clinic today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <motion.div
            key={stat.label}
            whileHover={{ y: -4 }}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">{stat.value}</p>
              </div>
              <div className={`rounded-xl bg-${stat.color}-50 p-3 text-${stat.color}-600`}>
                <stat.icon size={24} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Doctors List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Assigned Doctors</h2>
            <button className="text-sm font-medium text-sky-600 hover:underline">View All</button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {doctors.map((doctor) => {
              const docApps = appointments.filter(a => a.doctorId === doctor.uid);
              return (
                <div key={doctor.uid} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      {doctor.profileImageUrl ? (
                        <img src={doctor.profileImageUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                          <Stethoscope size={24} />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-slate-900">{doctor.fullName}</p>
                        <p className="text-xs text-slate-500">{doctor.specialization}</p>
                      </div>
                    </div>
                    <div className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                      doctor.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-500'
                    }`}>
                      {doctor.status || 'Active'}
                    </div>
                  </div>
                  <div className="mt-6 flex items-center justify-between rounded-xl bg-slate-50 p-3">
                    <div className="text-center">
                      <p className="text-xs text-slate-500 uppercase">Wait</p>
                      <p className="font-bold text-slate-900">{docApps.filter(a => ['confirmed', 'checked_in'].includes(a.status)).length}</p>
                    </div>
                    <div className="h-6 w-px bg-slate-200"></div>
                    <div className="text-center">
                      <p className="text-xs text-slate-500 uppercase">Total</p>
                      <p className="font-bold text-slate-900">{docApps.length}</p>
                    </div>
                    <div className="h-6 w-px bg-slate-200"></div>
                    <button className="rounded-lg bg-white p-2 text-sky-600 shadow-sm hover:text-sky-700">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
            {doctors.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-400">
                No doctors assigned to you yet.
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity Mini-Feed */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-slate-900">Patient Queue</h2>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-6">
            {appointments.filter(a => ['confirmed', 'checked_in', 'waiting', 'called'].includes(a.status)).slice(0, 5).map((app) => (
              <div key={app.id} className="flex items-center gap-4">
                <div className="h-10 w-10 shrink-0 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600 font-bold">
                  {app.queueNumber || '-'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{app.patientName}</p>
                  <p className="text-xs text-slate-500">with {app.doctorName}</p>
                </div>
                <div className={`h-2 w-2 rounded-full ${
                  app.status === 'called' ? 'bg-orange-500' : 'bg-green-500'
                }`}></div>
              </div>
            ))}
            {appointments.length === 0 && (
              <div className="py-10 text-center text-sm text-slate-400">
                Queue is empty
              </div>
            )}
            <button className="w-full rounded-xl bg-slate-50 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100">
              View Full Queue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
