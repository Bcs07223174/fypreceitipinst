import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Calendar,
  Clock,
  User,
  Phone,
  CheckCircle2,
  XCircle,
  LogOut,
  AlertCircle,
  Stethoscope,
  Users
} from 'lucide-react';
import { UserProfile, Appointment } from '../../types';
import { logout, getUserProfile } from '../../services/authService';
import { listenToAppointmentsByClinicAndDate, updateAppointmentStatus } from '../../services/realtimeDatabaseService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { format } from 'date-fns';

interface DoctorReceptionPageProps {
  profile: UserProfile | null;
}

export default function DoctorReceptionPage({ profile }: DoctorReceptionPageProps) {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [doctorName, setDoctorName] = useState('');

  useEffect(() => {
    if (!profile) {
      navigate('/login');
      return;
    }

    if (profile.role !== 'doctor') {
      navigate('/receptionist/dashboard');
      return;
    }

    // Get doctor info
    const getDoctorInfo = async () => {
      try {
        const docRef = doc(db, 'clinics', profile.clinicId, 'doctors', profile.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setDoctorName(docSnap.data().fullName);
        }
      } catch (error) {
        console.error('Error fetching doctor info:', error);
      }
    };

    getDoctorInfo();

    // Listen to appointments for this doctor
    setLoading(true);
    const unsub = listenToAppointmentsByClinicAndDate(
      profile.clinicId,
      date,
      [profile.uid],
      (data) => {
        // Filter for appointments that need confirmation (pending or booked status)
        const pendingAppointments = data.filter(app =>
          ['pending', 'booked'].includes(app.status)
        );
        setAppointments(pendingAppointments.sort((a, b) =>
          new Date(`${a.date} ${a.slotStartTime}`).getTime() -
          new Date(`${b.date} ${b.slotStartTime}`).getTime()
        ));
        setLoading(false);
      }
    );

    return () => {
      if (unsub) unsub();
    };
  }, [profile, date, navigate]);

  const handleConfirmAppointment = async (appointment: Appointment) => {
    if (!profile) return;

    setConfirmingId(appointment.id);
    try {
      await updateAppointmentStatus(
        profile.clinicId,
        appointment.id,
        appointment,
        'confirmed'
      );
    } catch (error) {
      console.error('Error confirming appointment:', error);
    } finally {
      setConfirmingId(null);
    }
  };

  const handleRejectAppointment = async (appointment: Appointment) => {
    if (!profile) return;

    setConfirmingId(appointment.id);
    try {
      await updateAppointmentStatus(
        profile.clinicId,
        appointment.id,
        appointment,
        'rejected'
      );
    } catch (error) {
      console.error('Error rejecting appointment:', error);
    } finally {
      setConfirmingId(null);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500 text-white">
                <Stethoscope size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Doctor Portal</h1>
                {doctorName && (
                  <p className="text-sm text-slate-500">{doctorName}</p>
                )}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 transition-all"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Date Filter */}
        <div className="mb-8 flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <Calendar size={18} className="text-slate-400" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border-none bg-transparent px-3 py-1 text-sm font-medium outline-none"
            />
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 shadow-sm border border-slate-200">
            <Users size={16} className="text-slate-400" />
            <span className="text-sm font-semibold text-slate-700">
              {appointments.length} {appointments.length === 1 ? 'Appointment' : 'Appointments'}
            </span>
          </div>
        </div>

        {/* Appointments Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-200 border-t-sky-500"></div>
          </div>
        ) : appointments.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-slate-200 bg-white p-12 text-center"
          >
            <div className="flex flex-col items-center gap-3">
              <Calendar size={48} className="text-slate-200" />
              <h3 className="text-lg font-semibold text-slate-900">No Appointments to Confirm</h3>
              <p className="text-slate-500">All appointments have been confirmed or there are no pending bookings for this date.</p>
            </div>
          </motion.div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {appointments.map((appointment, index) => (
              <motion.div
                key={appointment.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all hover:border-sky-200"
              >
                {/* Status Badge */}
                <div className="mb-4 flex items-center justify-between">
                  <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-bold uppercase text-amber-700">
                    {appointment.status === 'pending' ? '🔔 Pending' : '📅 Booked'}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    #{appointment.id?.slice(-6).toUpperCase()}
                  </span>
                </div>

                {/* Patient Info */}
                <div className="mb-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-600 font-bold text-sm flex-shrink-0">
                      {appointment.patientName?.[0]}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">{appointment.patientName}</p>
                      <p className="text-xs text-slate-500">{appointment.patientId}</p>
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="flex items-center gap-2 text-sl text-slate-600">
                    <Phone size={14} className="text-slate-400" />
                    <span className="text-sm">{appointment.patientPhone}</span>
                  </div>

                  {/* Time Slot */}
                  <div className="flex items-center gap-2 text-slate-600">
                    <Clock size={14} className="text-slate-400" />
                    <span className="text-sm font-medium">
                      {appointment.slotStartTime} - {appointment.slotEndTime}
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <p className="mb-3 text-xs font-semibold uppercase text-slate-500">Actions</p>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleConfirmAppointment(appointment)}
                      disabled={confirmingId === appointment.id}
                      className="flex items-center justify-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-600 hover:bg-green-100 transition-all disabled:opacity-50"
                    >
                      {confirmingId === appointment.id ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-green-300 border-t-green-600"></div>
                      ) : (
                        <CheckCircle2 size={16} />
                      )}
                      Confirm
                    </button>

                    <button
                      onClick={() => handleRejectAppointment(appointment)}
                      disabled={confirmingId === appointment.id}
                      className="flex items-center justify-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 transition-all disabled:opacity-50"
                    >
                      {confirmingId === appointment.id ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-300 border-t-red-600"></div>
                      ) : (
                        <XCircle size={16} />
                      )}
                      Reject
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
