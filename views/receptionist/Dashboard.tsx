import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Calendar,
  Stethoscope,
  CalendarDays,
  Moon,
  Phone,
  Sun,
  User,
  X
} from 'lucide-react';
import { UserProfile, DoctorProfile, ReceptionistProfile, DashboardDailySummary, DoctorSchedule, DoctorScheduleDay, Appointment } from '../../styles/types';
import {
  getReceptionistProfile,
  getAssignedDoctors,
  getDashboardSummary,
  rebuildDashboardSummary,
  getDoctorSchedulesForLinkedDoctors,
  getAppointmentsByDate,
  createReceptionistAppointment
} from '../../services/clinicService';
import { format } from 'date-fns';

interface DashboardProps {
  profile: UserProfile | null;
}

const toSafeDate = (date: string) => new Date(`${date}T00:00:00`);

const formatDateLabel = (date: string) => {
  const parsed = toSafeDate(date);
  return Number.isNaN(parsed.getTime()) ? date : format(parsed, 'EEE, MMM d');
};

const getScheduleDayForDate = (schedule: DoctorSchedule, date: string): DoctorScheduleDay | undefined => {
  const dayName = format(toSafeDate(date), 'EEEE').toLowerCase();
  const exactDay = schedule.days.find((day) => day.dateOfWeek === date);

  if (exactDay) {
    return exactDay;
  }

  return schedule.days.find((day) => day.dayOfWeek?.toLowerCase() === dayName);
};

export default function Dashboard({ profile }: DashboardProps) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [recProfile, setRecProfile] = useState<ReceptionistProfile | null>(null);
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [doctorSchedules, setDoctorSchedules] = useState<DoctorSchedule[]>([]);
  const [summary, setSummary] = useState<DashboardDailySummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [doctorsLoading, setDoctorsLoading] = useState(true);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [bookingDate, setBookingDate] = useState(today);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [bookedAppointments, setBookedAppointments] = useState<Appointment[]>([]);
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [bookingSaving, setBookingSaving] = useState(false);
  const [bookingMessage, setBookingMessage] = useState('');
  const [bookingWindowOpen, setBookingWindowOpen] = useState(false);
  const linkedDoctorCount = recProfile?.assignedDoctorIds.length || 0;
  const missingDoctorCount = Math.max(linkedDoctorCount - doctors.length, 0);
  const getDoctorSchedule = (doctor: DoctorProfile) => {
    const doctorIdentifiers = [doctor.uid, doctor.doctorId, doctor.firebaseUid]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase());

    return doctorSchedules.find((schedule) => {
      const scheduleIdentifiers = [schedule.doctorId, schedule.doctor_id]
        .filter(Boolean)
        .map((value) => String(value).trim().toLowerCase());

      return scheduleIdentifiers.some((id) => doctorIdentifiers.includes(id));
    });
  };
  const selectedDoctor = doctors.find((doctor) => doctor.uid === selectedDoctorId) || null;
  const selectedDoctorSchedule = selectedDoctor ? getDoctorSchedule(selectedDoctor) : undefined;
  const selectedScheduleDay = selectedDoctorSchedule
    ? getScheduleDayForDate(selectedDoctorSchedule, bookingDate)
    : undefined;
  const morningSlots = selectedScheduleDay && !selectedScheduleDay.isOffDay
    ? selectedScheduleDay.morningSlots.filter(Boolean)
    : [];
  const eveningSlots = selectedScheduleDay && !selectedScheduleDay.isOffDay
    ? selectedScheduleDay.eveningSlots.filter(Boolean)
    : [];
  const bookedSlotTimes = new Set(
    bookedAppointments
      .filter((appointment) => !['cancelled', 'missed', 'rejected'].includes(appointment.status))
      .flatMap((appointment) => [
        appointment.slotStartTime,
        appointment.appointmentTime,
      ])
      .filter(Boolean)
  );

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

        const loadedSchedules = await getDoctorSchedulesForLinkedDoctors(docIds);
        if (!isActive) return;
        setDoctorSchedules(loadedSchedules);
      } else {
        setDoctors([]);
        setDoctorSchedules([]);
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

  useEffect(() => {
    setSelectedSlot('');
    setBookingMessage('');
  }, [selectedDoctorId, bookingDate]);

  useEffect(() => {
    if (!profile || !selectedDoctor || !bookingWindowOpen) {
      setBookedAppointments([]);
      return;
    }

    const doctorIds = [selectedDoctor.uid, selectedDoctor.doctorId, selectedDoctor.firebaseUid]
      .filter(Boolean)
      .map(String);

    return getAppointmentsByDate(profile.clinicId, bookingDate, doctorIds, setBookedAppointments);
  }, [profile, selectedDoctor, bookingDate, bookingWindowOpen]);

  const openBookingWindow = (doctor: DoctorProfile) => {
    setSelectedDoctorId(doctor.uid);
    setBookingWindowOpen(true);
    setBookingMessage('');
    setSelectedSlot('');
  };

  const closeBookingWindow = () => {
    setBookingWindowOpen(false);
    setBookingMessage('');
    setSelectedSlot('');
  };

  const handleCreateReceptionBooking = async () => {
    if (!profile || !selectedDoctor || !selectedSlot) return;
    if (!patientName.trim() || !patientPhone.trim()) {
      setBookingMessage('Enter patient name and phone before booking.');
      return;
    }

    setBookingSaving(true);
    setBookingMessage('');

    try {
      await createReceptionistAppointment(profile.clinicId, bookingDate, {
        patientId: `walk-in-${Date.now()}`,
        patientName: patientName.trim(),
        patientPhone: patientPhone.trim(),
        doctorId: selectedDoctor.uid,
        doctorName: selectedDoctor.fullName || selectedDoctor.name || selectedDoctor.doctorName || 'Doctor',
        appointmentDate: bookingDate,
        appointmentTime: selectedSlot,
        slotStartTime: selectedSlot,
        slotEndTime: selectedSlot,
        status: 'booked',
        paymentStatus: 'pending',
        qrVerified: false,
        createdBy: 'reception',
        createdById: profile.uid,
      });

      setPatientName('');
      setPatientPhone('');
      setSelectedSlot('');
      setBookingMessage('Appointment booked by reception.');
      await rebuildDashboardSummary(profile.clinicId, bookingDate);
    } catch (error) {
      console.error('Error creating reception booking:', error);
      setBookingMessage('Unable to book this slot. Please try again.');
    } finally {
      setBookingSaving(false);
    }
  };

  const renderSlotSection = (title: string, slots: string[], Icon: typeof Sun) => (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
        <Icon size={16} className="text-sky-600" />
        {title}
      </div>
      {slots.length === 0 ? (
        <p className="text-sm text-slate-500">No {title.toLowerCase()} available.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {slots.map((slot) => {
            const isBooked = bookedSlotTimes.has(slot);
            const isActive = selectedSlot === slot;
            return (
              <button
                key={`${title}-${slot}`}
                type="button"
                disabled={isBooked}
                onClick={() => setSelectedSlot(slot)}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  isBooked
                    ? 'cursor-not-allowed border-rose-200 bg-rose-50 text-rose-500 line-through'
                    : isActive
                      ? 'border-sky-300 bg-sky-600 text-white'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300'
                }`}
              >
                {slot}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

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
              const isSelected = selectedDoctorId === doctor.uid;
              return (
                <div key={doctor.uid} className={`flex flex-col rounded-2xl border bg-white p-5 transition-shadow hover:shadow-md ${
                  isSelected ? 'border-sky-300 ring-2 ring-sky-100' : 'border-slate-200'
                }`}>
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
                    <button
                      onClick={() => openBookingWindow(doctor)}
                      className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
                    >
                      Book
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

      {bookingWindowOpen && selectedDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white p-5">
              <div className="flex items-center gap-4">
                {selectedDoctor.profileImageUrl ? (
                  <img src={selectedDoctor.profileImageUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                    <Stethoscope size={24} />
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-bold text-slate-950">{selectedDoctor.fullName || selectedDoctor.name || selectedDoctor.doctorName}</h2>
                  <p className="text-sm text-slate-500">{selectedDoctor.specialization || 'Doctor'}</p>
                </div>
              </div>
              <button
                onClick={closeBookingWindow}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                title="Close booking window"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <label className="block text-sm font-semibold text-slate-700">
                Select Date
                <input
                  type="date"
                  value={bookingDate}
                  onChange={(event) => setBookingDate(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </label>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <CalendarDays size={16} className="text-sky-600" />
                  Slots for {formatDateLabel(bookingDate)}
                </div>
                {!selectedDoctorSchedule && (
                  <p className="mt-3 text-sm text-amber-700">No schedule found for this doctor.</p>
                )}
                {selectedDoctorSchedule && selectedScheduleDay?.isOffDay && (
                  <p className="mt-3 text-sm text-slate-500">Doctor is off on this date.</p>
                )}
                {selectedDoctorSchedule && !selectedScheduleDay && (
                  <p className="mt-3 text-sm text-slate-500">No slots match this date.</p>
                )}
              </div>

              {selectedScheduleDay && !selectedScheduleDay.isOffDay && (
                <div className="grid gap-4 lg:grid-cols-2">
                  {renderSlotSection('Morning Slots', morningSlots, Sun)}
                  {renderSlotSection('Evening Slots', eveningSlots, Moon)}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700">
                  <span className="flex items-center gap-2"><User size={14} /> Patient Name</span>
                  <input
                    value={patientName}
                    onChange={(event) => setPatientName(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    placeholder="Patient full name"
                  />
                </label>

                <label className="block text-sm font-semibold text-slate-700">
                  <span className="flex items-center gap-2"><Phone size={14} /> Phone</span>
                  <input
                    value={patientPhone}
                    onChange={(event) => setPatientPhone(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    placeholder="Patient phone number"
                  />
                </label>
              </div>

              {bookingMessage && (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{bookingMessage}</p>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                <button
                  onClick={closeBookingWindow}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateReceptionBooking}
                  disabled={!selectedSlot || bookingSaving}
                  className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {bookingSaving ? 'Booking...' : 'Book by Reception'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
