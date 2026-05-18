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
import { UserProfile, DoctorProfile, ReceptionistProfile, DashboardDailySummary } from '../../types';
import { getReceptionistProfile, getAssignedDoctors, getDashboardSummary, rebuildDashboardSummary } from '../../services/clinicService';
import { format } from 'date-fns';

interface DashboardProps {
  profile: UserProfile | null;
}

export default function Dashboard({ profile }: DashboardProps) {
  const [recProfile, setRecProfile] = useState<ReceptionistProfile | null>(null);
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [summary, setSummary] = useState<DashboardDailySummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [doctorsLoading, setDoctorsLoading] = useState(true);
  const today = format(new Date(), 'yyyy-MM-dd');
  const linkedDoctorCount = recProfile?.assignedDoctorIds.length || 0;
  const missingDoctorCount = Math.max(linkedDoctorCount - doctors.length, 0);

  useEffect(() => {
    let unsubSummary: (() => void) | undefined;
    let isActive = true;

    const setup = async () => {
      if (!profile) return;

      const data = await getReceptionistProfile(profile.clinicId, profile.uid);
      if (!isActive) return;

      setRecProfile(data);
      const docIds = data?.assignedDoctorIds || [];
      if (docIds.length) {
        const loadedDoctors = await getAssignedDoctors(profile.clinicId, docIds);
        if (!isActive) return;
        setDoctors(loadedDoctors);
      } else {
        setDoctors([]);
      }
      setDoctorsLoading(false);

      unsubSummary = getDashboardSummary(profile.clinicId, today, (value) => {
        if (!isActive) return;
        setSummary(value);
        setSummaryLoading(false);
      });

      // One-time refresh ensures first-time dashboards get a summary without waiting for a write event.
      rebuildDashboardSummary(profile.clinicId, today).catch((error) => {
        console.error('Error rebuilding dashboard summary:', error);
      });
    };

    setup();

    return () => {
      isActive = false;
      if (unsubSummary) unsubSummary();
    };
  }, [profile, today]);

  const statsData = summary || {
    todayAppointments: 0,
    waitingPatients: 0,
    completed: 0,
    cancelled: 0,
  };

  const stats = [
    { label: 'Total Appointments', value: statsData.todayAppointments, icon: Calendar, color: 'sky' },
    { label: 'Waiting List', value: statsData.waitingPatients, icon: Clock, color: 'orange' },
    { label: 'Completed', value: statsData.completed, icon: CheckCircle2, color: 'green' },
    { label: 'Cancelled', value: statsData.cancelled, icon: AlertCircle, color: 'red' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome Back, {recProfile?.fullName || 'Receptionist'}</h1>
        <p className="text-slate-500">Here's what's happening at the clinic today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {summaryLoading
          ? Array.from({ length: 4 }).map((_, index) => (
              <div key={`stat-skeleton-${index}`} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
                <div className="mt-3 h-8 w-16 animate-pulse rounded bg-slate-200" />
              </div>
            ))
          : stats.map((stat) => (
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
          {!doctorsLoading && linkedDoctorCount > 0 && (
            <p className="text-xs text-slate-500">
              Linked doctor IDs: {linkedDoctorCount} | Loaded doctor records: {doctors.length}
            </p>
          )}
          {!doctorsLoading && missingDoctorCount > 0 && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {missingDoctorCount} linked doctor record{missingDoctorCount === 1 ? '' : 's'} are missing from the clinic doctors collection.
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {doctorsLoading &&
              Array.from({ length: 2 }).map((_, index) => (
                <div key={`doc-skeleton-${index}`} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
                  <div className="mt-3 h-4 w-24 animate-pulse rounded bg-slate-200" />
                  <div className="mt-6 h-14 animate-pulse rounded-xl bg-slate-100" />
                </div>
              ))}
            {!doctorsLoading && doctors.map((doctor) => {
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
                      <p className="font-bold text-slate-900">-</p>
                    </div>
                    <div className="h-6 w-px bg-slate-200"></div>
                    <div className="text-center">
                      <p className="text-xs text-slate-500 uppercase">Total</p>
                      <p className="font-bold text-slate-900">-</p>
                    </div>
                    <div className="h-6 w-px bg-slate-200"></div>
                    <button className="rounded-lg bg-white p-2 text-sky-600 shadow-sm hover:text-sky-700">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
            {!doctorsLoading && doctors.length === 0 && (
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
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Patients currently in queue</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">
                {summaryLoading ? '...' : statsData.waitingPatients}
              </p>
            </div>
            <div className="text-sm text-slate-500">
              Open the Queue page for live per-patient updates.
            </div>
            <button className="w-full rounded-xl bg-slate-50 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100">
              View Full Queue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
