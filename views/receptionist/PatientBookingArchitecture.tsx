import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Clock,
  CreditCard,
  MapPin,
  ShieldCheck,
  Star,
  Stethoscope,
  Timer,
  User,
  X,
} from 'lucide-react';
import { UserProfile } from '../../styles/types';
import {
  type BookedSlotRecord,
  type PatientDoctor,
  type PatientDoctorSchedule,
  type SlotDisplayStatus,
  type SlotLockRecord,
  confirmPatientBooking,
  fetchActiveDoctors,
  fetchDoctorSchedule,
  getScheduleDay,
  getSlotDisplayStatus,
  holdPatientSlot,
  listenToBookedSlots,
  listenToSlotLocks,
  loadDoctorsFromCache,
  releasePatientSlot,
} from '../../services/patientBookingService';

interface PatientBookingProps {
  profile?: UserProfile | null;
}

const toDateKey = (date: Date) => date.toISOString().slice(0, 10);

const getErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('SLOT_ALREADY_BOOKED')) return 'This slot is already booked. Please select another slot.';
  if (message.includes('SLOT_CURRENTLY_HELD')) return 'This slot is currently being selected by another patient. Please choose another slot.';
  if (message.includes('LOCK_EXPIRED')) return 'Your slot hold expired. Please select the slot again.';
  if (message.includes('SLOT_NOT_IN_SCHEDULE')) return 'This slot is not available in the doctor schedule.';
  if (message.includes('SCHEDULE_NOT_FOUND')) return 'Doctor schedule was not found.';
  if (message.includes('PAYMENT_FAILED')) return 'Payment failed. Please try again.';

  return 'Booking failed. Please try again.';
};

const slotStyle: Record<SlotDisplayStatus, string> = {
  available: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300',
  held: 'cursor-not-allowed border-amber-200 bg-amber-50 text-amber-700',
  selected_by_me: 'border-sky-300 bg-sky-600 text-white shadow-sm shadow-sky-100',
  booked: 'cursor-not-allowed border-rose-200 bg-rose-50 text-rose-500 line-through',
};

const slotLabel: Record<SlotDisplayStatus, string> = {
  available: '',
  held: 'Held',
  selected_by_me: 'Selected',
  booked: 'Booked',
};

export default function PatientBookingArchitecture({ profile }: PatientBookingProps) {
  const today = toDateKey(new Date());
  const currentPatientId = profile?.uid || 'guest-patient';
  const [doctors, setDoctors] = useState<PatientDoctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState<PatientDoctor | null>(null);
  const [schedule, setSchedule] = useState<PatientDoctorSchedule | null>(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [bookedSlots, setBookedSlots] = useState<BookedSlotRecord[]>([]);
  const [slotLocks, setSlotLocks] = useState<SlotLockRecord[]>([]);
  const [patientName, setPatientName] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmationCard, setConfirmationCard] = useState<{
    appointmentKey: string;
    patientName: string;
    date: string;
    startTime: string;
  } | null>(null);
  const [holdingSlot, setHoldingSlot] = useState(false);
  const [booking, setBooking] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());

  const selectedDay = schedule ? getScheduleDay(schedule, selectedDate) : undefined;
  const morningSlots = selectedDay && !selectedDay.isOffDay ? selectedDay.morningSlots : [];
  const eveningSlots = selectedDay && !selectedDay.isOffDay ? selectedDay.eveningSlots : [];
  const selectedLock = selectedSlot
    ? slotLocks.find((lock) => lock.startTime === selectedSlot && lock.patientId === currentPatientId)
    : undefined;
  const remainingSeconds = selectedLock
    ? Math.max(0, Math.ceil((selectedLock.expiresAt.toMillis() - nowMs) / 1000))
    : 0;

  const hasSlots = morningSlots.length > 0 || eveningSlots.length > 0;

  useEffect(() => {
    setDoctors(loadDoctorsFromCache());

    fetchActiveDoctors()
      .then(setDoctors)
      .catch(() => setError('Booking failed. Please try again.'))
      .finally(() => setLoadingDoctors(false));
  }, []);

  useEffect(() => {
    if (!selectedDoctor) return;

    setLoadingSchedule(true);
    setSchedule(null);
    setSelectedSlot('');
    setError('');
    setSuccess('');
    setConfirmationCard(null);

    fetchDoctorSchedule(selectedDoctor.id)
      .then(setSchedule)
      .catch(() => setError('Doctor schedule was not found.'))
      .finally(() => setLoadingSchedule(false));
  }, [selectedDoctor]);

  useEffect(() => {
    if (!selectedDoctor) {
      setBookedSlots([]);
      setSlotLocks([]);
      return;
    }

    const unsubscribeBooked = listenToBookedSlots(selectedDoctor.id, selectedDate, setBookedSlots);
    const unsubscribeLocks = listenToSlotLocks(selectedDoctor.id, selectedDate, setSlotLocks);

    return () => {
      unsubscribeBooked();
      unsubscribeLocks();
    };
  }, [selectedDoctor, selectedDate]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedDoctor || !selectedSlot || !selectedLock) return;
    if (remainingSeconds > 0) return;

    releasePatientSlot({
      doctorId: selectedDoctor.id,
      patientId: currentPatientId,
      date: selectedDate,
      startTime: selectedSlot,
    }).catch(() => undefined);
    setSelectedSlot('');
    setError('Your slot hold expired. Please select the slot again.');
  }, [currentPatientId, remainingSeconds, selectedDate, selectedDoctor, selectedLock, selectedSlot]);

  useEffect(() => () => {
    if (!selectedDoctor || !selectedSlot) return;

    releasePatientSlot({
      doctorId: selectedDoctor.id,
      patientId: currentPatientId,
      date: selectedDate,
      startTime: selectedSlot,
    }).catch(() => undefined);
  }, [currentPatientId, selectedDate, selectedDoctor, selectedSlot]);

  const visibleDoctors = useMemo(() => doctors.filter((doctor) => doctor.isActive), [doctors]);

  const handleSelectSlot = async (slot: string) => {
    if (!selectedDoctor || !schedule || holdingSlot) return;

    const status = getSlotDisplayStatus(slot, selectedDoctor.id, selectedDate, currentPatientId, bookedSlots, slotLocks, nowMs);
    if (status === 'booked' || status === 'held') return;

    setHoldingSlot(true);
    setError('');
    setSuccess('');

    try {
      if (selectedSlot && selectedSlot !== slot) {
        await releasePatientSlot({
          doctorId: selectedDoctor.id,
          patientId: currentPatientId,
          date: selectedDate,
          startTime: selectedSlot,
        });
      }

      await holdPatientSlot({
        schedule,
        doctorId: selectedDoctor.id,
        patientId: currentPatientId,
        date: selectedDate,
        startTime: slot,
      });
      setSelectedSlot(slot);
    } catch (slotError) {
      setError(getErrorMessage(slotError));
    } finally {
      setHoldingSlot(false);
    }
  };

  const handleCloseBooking = async () => {
    if (selectedDoctor && selectedSlot) {
      await releasePatientSlot({
        doctorId: selectedDoctor.id,
        patientId: currentPatientId,
        date: selectedDate,
        startTime: selectedSlot,
      }).catch(() => undefined);
    }

    setSelectedDoctor(null);
    setSchedule(null);
    setSelectedSlot('');
    setPatientName('');
    setReason('');
    setError('');
    setSuccess('');
    setConfirmationCard(null);
  };

  const handleConfirmBooking = async () => {
    if (!selectedDoctor || !schedule || !selectedSlot || booking) return;
    if (!patientName.trim()) {
      setError('Enter patient name before confirming.');
      return;
    }

    setBooking(true);
    setError('');
    setSuccess('');

    try {
      const confirmedBooking = await confirmPatientBooking({
        schedule,
        doctorId: selectedDoctor.id,
        patientId: currentPatientId,
        patientName: patientName.trim(),
        date: selectedDate,
        startTime: selectedSlot,
        reason: reason.trim(),
        paymentStatus: 'paid',
      });

      setConfirmationCard({
        appointmentKey: confirmedBooking.appointmentKey,
        patientName: patientName.trim(),
        date: selectedDate,
        startTime: selectedSlot,
      });
      setSuccess('');
      setSelectedSlot('');
      setPatientName('');
      setReason('');
    } catch (bookingError) {
      setError(getErrorMessage(bookingError));
    } finally {
      setBooking(false);
    }
  };

  const renderSlots = (title: string, slots: string[]) => (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
        <Clock size={16} className="text-sky-600" />
        {title}
      </div>
      {slots.length === 0 ? (
        <p className="text-sm text-slate-500">No slots available.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {slots.map((slot) => {
            const status = selectedDoctor
              ? getSlotDisplayStatus(slot, selectedDoctor.id, selectedDate, currentPatientId, bookedSlots, slotLocks, nowMs)
              : 'available';
            const disabled = status === 'booked' || status === 'held' || holdingSlot || booking;

            return (
              <button
                key={`${title}-${slot}`}
                disabled={disabled}
                onClick={() => handleSelectSlot(slot)}
                className={`min-h-14 rounded-xl border px-3 py-2 text-sm font-bold transition ${slotStyle[status]}`}
              >
                <span className="block">{slot}</span>
                {slotLabel[status] && <span className="mt-1 block text-[11px]">{slotLabel[status]}</span>}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Patient Booking</h1>
            <p className="mt-1 text-sm text-slate-500">Select a doctor, hold a live slot, then confirm a transaction-safe appointment.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
            <ShieldCheck size={16} />
            Firestore transaction protected
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loadingDoctors && visibleDoctors.length === 0 && (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-56 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          ))
        )}

        {visibleDoctors.map((doctor) => (
          <article key={doctor.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-4">
              {doctor.photoUrl ? (
                <img src={doctor.photoUrl} alt="" className="h-14 w-14 rounded-xl object-cover" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                  <Stethoscope size={26} />
                </div>
              )}
              <div className="min-w-0">
                <h2 className="font-bold text-slate-950">{doctor.name}</h2>
                <p className="text-sm text-slate-500">{doctor.specialization}</p>
                <div className="mt-2 flex items-center gap-1 text-xs font-bold text-amber-600">
                  <Star size={13} className="fill-amber-400" />
                  {doctor.rating.toFixed(1)}
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-2 text-sm text-slate-600">
              <p className="flex items-center gap-2"><MapPin size={15} className="text-slate-400" />{doctor.location}</p>
              <p className="flex items-center gap-2"><CalendarDays size={15} className="text-slate-400" />{doctor.clinicName}</p>
              <p className="font-semibold text-slate-900">Fee: {doctor.doctor_fee || 'N/A'}</p>
            </div>

            <button
              onClick={() => setSelectedDoctor(doctor)}
              className="mt-5 rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-sky-700"
            >
              Book
            </button>
          </article>
        ))}

        {!loadingDoctors && visibleDoctors.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 md:col-span-2 xl:col-span-3">
            No active doctors found.
          </div>
        )}
      </section>

      {selectedDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white p-5">
              <div>
                <h2 className="text-xl font-bold text-slate-950">{selectedDoctor.name}</h2>
                <p className="text-sm text-slate-500">{selectedDoctor.specialization}</p>
              </div>
              <button onClick={handleCloseBooking} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5 p-5">
              {confirmationCard && (
                <div className="mx-auto max-w-sm rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase text-emerald-600">Appointment Booked</p>
                      <h3 className="mt-1 text-lg font-bold text-slate-950">{confirmationCard.patientName}</h3>
                    </div>
                    <button
                      onClick={handleCloseBooking}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                      title="Close"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="flex flex-col items-center gap-4">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(confirmationCard.appointmentKey)}`}
                      alt="Appointment QR code"
                      className="h-36 w-36 rounded-xl border border-slate-200 bg-white p-2"
                    />
                    <div className="w-full rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                      <p><span className="font-bold text-slate-900">Key:</span> {confirmationCard.appointmentKey}</p>
                      <p><span className="font-bold text-slate-900">Date:</span> {confirmationCard.date}</p>
                      <p><span className="font-bold text-slate-900">Slot:</span> {confirmationCard.startTime}</p>
                    </div>
                  </div>
                </div>
              )}

              {!confirmationCard && (
                <>
              <div className="grid gap-4 lg:grid-cols-3">
                <label className="block text-sm font-bold text-slate-700">
                  Select Date
                  <input
                    type="date"
                    value={selectedDate}
                    min={today}
                    onChange={(event) => {
                      setSelectedDate(event.target.value);
                      setSelectedSlot('');
                      setError('');
                      setSuccess('');
                    }}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  />
                </label>

                <label className="block text-sm font-bold text-slate-700 lg:col-span-2">
                  Patient Name
                  <div className="relative mt-2">
                    <User className="absolute left-3 top-2.5 text-slate-400" size={16} />
                    <input
                      value={patientName}
                      onChange={(event) => setPatientName(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                      placeholder="Patient full name"
                    />
                  </div>
                </label>
              </div>

              <label className="block text-sm font-bold text-slate-700">
                Reason
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="mt-2 min-h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  placeholder="Brief reason for visit"
                />
              </label>

              {selectedLock && remainingSeconds > 0 && (
                <div className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-700">
                  <Timer size={17} />
                  Slot hold expires in {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, '0')}
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                {loadingSchedule && <p className="text-sm text-slate-500">Loading doctor schedule...</p>}
                {!loadingSchedule && !schedule && <p className="text-sm text-amber-700">Doctor schedule was not found.</p>}
                {schedule && selectedDay?.isOffDay && <p className="text-sm text-slate-500">Doctor is off on this date.</p>}
                {schedule && !selectedDay && <p className="text-sm text-slate-500">No schedule matches this date.</p>}
                {schedule && selectedDay && !selectedDay.isOffDay && !hasSlots && <p className="text-sm text-slate-500">No slots available on this date.</p>}
              </div>

              {schedule && selectedDay && !selectedDay.isOffDay && hasSlots && (
                <div className="grid gap-4 lg:grid-cols-2">
                  {renderSlots('Morning Slots', morningSlots)}
                  {renderSlots('Evening Slots', eveningSlots)}
                </div>
              )}

              {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
              {success && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{success}</p>}

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                <button onClick={handleCloseBooking} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
                <button
                  onClick={handleConfirmBooking}
                  disabled={!selectedSlot || booking || holdingSlot}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <CreditCard size={16} />
                  {booking ? 'Booking...' : 'Confirm Booking'}
                </button>
              </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
