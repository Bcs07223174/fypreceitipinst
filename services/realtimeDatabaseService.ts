import {
  ref,
  onValue,
  update,
  set,
  get,
  child,
  remove,
  serverTimestamp,
  query,
  orderByChild,
  equalTo,
  Unsubscribe
} from 'firebase/database';
import { rtdb } from '../lib/firebase';
import { Appointment, AppointmentStatus, DashboardDailySummary } from '../types';

type AppointmentSummary = Pick<
  Appointment,
  | 'patientId'
  | 'patientName'
  | 'patientPhone'
  | 'doctorId'
  | 'doctorName'
  | 'date'
  | 'appointmentDate'
  | 'appointmentTime'
  | 'slotStartTime'
  | 'slotEndTime'
  | 'status'
  | 'appointmentKey'
  | 'queueNumber'
  | 'checkedInAt'
  | 'updatedAt'
>;

const appointmentSummaryPath = (clinicId: string, date: string, appointmentId?: string) =>
  appointmentId
    ? `appointmentSummaries/${clinicId}/${date}/${appointmentId}`
    : `appointmentSummaries/${clinicId}/${date}`;

const resolveClinicIds = (clinicId: string): string[] => {
  const aliases = new Set<string>([clinicId]);

  if (clinicId === 'demo-clinic-1') {
    aliases.add('CLINIC-DEFAULT');
  }
  if (clinicId === 'CLINIC-DEFAULT') {
    aliases.add('demo-clinic-1');
  }

  return Array.from(aliases);
};

const normalizeDoctorId = (value?: string): string => String(value ?? '').trim().replace(/_/g, '-').toLowerCase();

const doctorIdMatches = (appointmentDoctorId: string, doctorIds: string[]): boolean => {
  if (doctorIds.length === 0) return true;

  const normalizedAppointmentDoctorId = normalizeDoctorId(appointmentDoctorId);
  return doctorIds.some((doctorId) => {
    if (normalizeDoctorId(doctorId) === normalizedAppointmentDoctorId) return true;
    return normalizeDoctorId(doctorId) === normalizedAppointmentDoctorId;
  });
};

const dashboardSummaryPath = (clinicId: string, date: string) =>
  `dashboardSummaries/${clinicId}/${date}`;

const doctorAppointmentsPath = (clinicId: string, doctorId: string, appointmentId?: string) =>
  appointmentId
    ? `doctorAppointments/${clinicId}/${doctorId}/${appointmentId}`
    : doctorId
      ? `doctorAppointments/${clinicId}/${doctorId}`
      : `doctorAppointments/${clinicId}`;

const emptyDashboardSummary = (): DashboardDailySummary => ({
  todayAppointments: 0,
  waitingPatients: 0,
  completed: 0,
  cancelled: 0,
});

const toAppointmentSummary = (
  appointment: Partial<Appointment>,
  date: string
): AppointmentSummary => ({
  patientId: appointment.patientId || '',
  patientName: appointment.patientName || '',
  patientPhone: appointment.patientPhone || '',
  doctorId: appointment.doctorId || '',
  doctorName: appointment.doctorName || '',
  date: appointment.date || date,
  appointmentDate: appointment.appointmentDate || appointment.date || date,
  appointmentTime: appointment.appointmentTime || appointment.slotStartTime || '',
  slotStartTime: appointment.slotStartTime || '',
  slotEndTime: appointment.slotEndTime || '',
  status: (appointment.status || 'pending') as AppointmentStatus,
  appointmentKey: appointment.appointmentKey,
  updatedAt: appointment.updatedAt,
});

const stripUndefinedFields = <T extends Record<string, unknown>>(value: T): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined));

const collectAppointmentLeaves = (
  node: any,
  branchDoctorId: string = '',
  path: string[] = []
): Array<{ appointmentId: string; doctorId: string; [key: string]: unknown }> => {
  if (!node || typeof node !== 'object') {
    return [];
  }

  if ((node as { appointmentId?: string }).appointmentId || (node as { patientName?: string }).patientName || (node as { appointmentKey?: string }).appointmentKey || (node as { date?: string }).date || (node as { slotStartTime?: string }).slotStartTime) {
    return [{
      appointmentId: (node as { appointmentId?: string }).appointmentId || path[path.length - 1] || '',
      doctorId: (node as { doctorId?: string }).doctorId || branchDoctorId,
      ...node,
    }];
  }

  return Object.entries(node).flatMap(([childKey, childValue]) =>
    collectAppointmentLeaves(childValue, branchDoctorId || childKey, [...path, childKey])
  );
};

const normalizeAppointmentRecord = (
  id: string,
  value: Record<string, unknown>,
  fallbackDate: string
): Appointment => {
  const date =
    (value.date as string | undefined) ||
    (value.appointmentDate as string | undefined) ||
    fallbackDate;

  const slotStartTime =
    (value.slotStartTime as string | undefined) ||
    (value.appointmentTime as string | undefined) ||
    '';

  const slotEndTime =
    (value.slotEndTime as string | undefined) ||
    slotStartTime;

  return {
    id: (value.id as string | undefined) || (value.appointmentId as string | undefined) || id,
    patientId: (value.patientId as string | undefined) || '',
    patientName: (value.patientName as string | undefined) || '',
    patientPhone: (value.patientPhone as string | undefined) || '',
    doctorId: (value.doctorId as string | undefined) || '',
    doctorName: (value.doctorName as string | undefined) || '',
    clinicId: (value.clinicId as string | undefined) || '',
    date,
    appointmentDate: (value.appointmentDate as string | undefined) || date,
    appointmentTime: (value.appointmentTime as string | undefined) || slotStartTime,
    slotStartTime,
    slotEndTime,
    appointmentKey: value.appointmentKey as string | undefined,
    status: ((value.status as AppointmentStatus | undefined) || 'pending') as AppointmentStatus,
    qrVerified: Boolean(value.qrVerified),
    queueNumber: value.queueNumber as number | undefined,
    checkedInAt: value.checkedInAt,
    updatedAt: value.updatedAt,
    createdAt: value.createdAt,
  } as Appointment;
};

const computeDashboardSummary = (items: AppointmentSummary[]): DashboardDailySummary => {
  const summary = emptyDashboardSummary();
  summary.todayAppointments = items.length;
  summary.waitingPatients = items.filter((item) => ['confirmed', 'checked_in', 'waiting', 'called', 'in_consultation'].includes(item.status)).length;
  summary.completed = items.filter((item) => item.status === 'completed').length;
  summary.cancelled = items.filter((item) => ['cancelled', 'rejected', 'missed'].includes(item.status)).length;
  return summary;
};

export const refreshDashboardSummary = async (clinicId: string, date: string): Promise<void> => {
  const summariesRef = ref(rtdb, appointmentSummaryPath(clinicId, date));
  const snapshot = await get(summariesRef);

  const data = snapshot.val() as Record<string, AppointmentSummary> | null;
  let items = data ? Object.values(data) : [];

  if (items.length === 0) {
    const fallbackItems: AppointmentSummary[] = [];
    const clinicAliases = resolveClinicIds(clinicId);

    const dateQuery = query(ref(rtdb, 'appointments'), orderByChild('appointmentDate'), equalTo(date));
    const flatSnapshot = await get(dateQuery);
    const flatData = flatSnapshot.val() as Record<string, unknown> | null;

    if (flatData) {
      Object.entries(flatData).forEach(([flatId, flatValue]) => {
        if (!flatValue || typeof flatValue !== 'object') return;
        const normalized = normalizeAppointmentRecord(flatId, flatValue as Record<string, unknown>, date);
        if (normalized.date !== date) return;
        if (!clinicAliases.includes(normalized.clinicId || '')) return;
        fallbackItems.push(toAppointmentSummary(normalized, date));
      });
    }

    items = fallbackItems;
  }

  const summary = computeDashboardSummary(items);

  const summaryRef = ref(rtdb, dashboardSummaryPath(clinicId, date));
  await set(summaryRef, {
    ...summary,
    updatedAt: serverTimestamp(),
  });
};

export const listenToDashboardSummary = (
  clinicId: string,
  date: string,
  callback: (summary: DashboardDailySummary) => void
): Unsubscribe => {
  const summaryRef = ref(rtdb, dashboardSummaryPath(clinicId, date));

  return onValue(summaryRef, (snapshot) => {
    const data = snapshot.val() as DashboardDailySummary | null;
    callback(data || emptyDashboardSummary());
  }, (error) => {
    console.error('Error listening to dashboard summary:', error);
    callback(emptyDashboardSummary());
  });
};

/**
 * Get appointments by clinic and date from Realtime Database
 * Listens to real-time updates
 */
export const listenToAppointmentsByClinicAndDate = (
  clinicId: string,
  date: string,
  doctorIds: string[],
  callback: (appointments: Appointment[]) => void
): Unsubscribe => {
  if (!clinicId || !date) {
    console.warn("listenToAppointmentsByClinicAndDate called with missing clinicId or date:", { clinicId, date });
    callback([]);
    return () => {};
  }

  const clinicAliases = resolveClinicIds(clinicId);
  const sourceItems = new Map<string, Appointment[]>();
  const unsubs: Unsubscribe[] = [];

  const applyDoctorFilter = (items: Appointment[]) => {
    return items.filter((app) => doctorIdMatches(app.doctorId, doctorIds));
  };

  const emitMerged = () => {
    const mergedById = new Map<string, Appointment>();

    sourceItems.forEach((items) => {
      items.forEach((item) => {
        mergedById.set(item.id, item);
      });
    });

    callback(applyDoctorFilter(Array.from(mergedById.values())));
  };

  clinicAliases.forEach((alias) => {
    const summaryKey = `summary:${alias}`;
    const nestedKey = `nested:${alias}`;
    const doctorKey = `doctor:${alias}`;

    unsubs.push(onValue(ref(rtdb, appointmentSummaryPath(alias, date)), (snapshot) => {
      const data = snapshot.val() as Record<string, Record<string, unknown>> | null;

      if (!data) {
        sourceItems.set(summaryKey, []);
        emitMerged();
        return;
      }

      sourceItems.set(
        summaryKey,
        Object.entries(data).map(([id, value]: [string, any]) =>
          normalizeAppointmentRecord(id, value as Record<string, unknown>, date)
        )
      );
      emitMerged();
    }, (error) => {
      console.error('Error listening to appointment summaries:', error);
      sourceItems.set(summaryKey, []);
      emitMerged();
    }));

    unsubs.push(onValue(ref(rtdb, `appointments/${alias}/${date}`), (snapshot) => {
      const data = snapshot.val();

      if (!data) {
        sourceItems.set(nestedKey, []);
        emitMerged();
        return;
      }

      sourceItems.set(
        nestedKey,
        Object.entries(data).map(([id, value]: [string, any]) =>
          normalizeAppointmentRecord(id, value as Record<string, unknown>, date)
        )
      );
      emitMerged();
    }, (error) => {
      console.error('Error listening to nested appointments:', error);
      sourceItems.set(nestedKey, []);
      emitMerged();
    }));

    unsubs.push(onValue(ref(rtdb, doctorAppointmentsPath(alias, '')), (snapshot) => {
      const data = snapshot.val();

      if (!data) {
        sourceItems.set(doctorKey, []);
        emitMerged();
        return;
      }

      const doctorItems = collectAppointmentLeaves(data)
        .map((item) => normalizeAppointmentRecord(
          item.appointmentId,
          item as Record<string, unknown>,
          (item.date as string | undefined) || date
        ))
        .filter((item) => item.date === date);

      sourceItems.set(doctorKey, doctorItems);
      emitMerged();
    }, (error) => {
      console.error('Error listening to doctor appointments:', error);
      sourceItems.set(doctorKey, []);
      emitMerged();
    }));
  });

  const flatDateQuery = query(ref(rtdb, 'appointments'), orderByChild('appointmentDate'), equalTo(date));
  unsubs.push(onValue(flatDateQuery, (snapshot) => {
    const flatData = snapshot.val() as Record<string, unknown> | null;

    if (!flatData) {
      sourceItems.set('flat', []);
      emitMerged();
      return;
    }

    const flatItems: Appointment[] = [];
    Object.entries(flatData).forEach(([flatId, flatValue]) => {
      if (!flatValue || typeof flatValue !== 'object') return;
      const normalized = normalizeAppointmentRecord(flatId, flatValue as Record<string, unknown>, date);
      if (normalized.date !== date) return;
      if (!clinicAliases.includes(normalized.clinicId || '')) return;
      flatItems.push(normalized);
    });

    sourceItems.set('flat', flatItems);
    emitMerged();
  }, (error) => {
    console.error('Error listening to flat appointments fallback:', error);
    sourceItems.set('flat', []);
    emitMerged();
  }));

  return () => {
    unsubs.forEach((off) => off());
  };
};

/**
 * Get all appointments for a clinic
 */
export const listenToAppointmentsByClinic = (
  clinicId: string,
  callback: (appointments: Appointment[]) => void
): Unsubscribe => {
  const appointmentsRef = ref(rtdb, `appointments/${clinicId}`);
  
  return onValue(appointmentsRef, (snapshot) => {
    const data = snapshot.val();
    
    if (!data) {
      callback([]);
      return;
    }

    const appointments: Appointment[] = [];
    Object.entries(data).forEach(([date, dateData]: [string, any]) => {
      Object.entries(dateData).forEach(([id, appointment]: [string, any]) => {
        appointments.push({
          id,
          date,
          ...appointment
        } as Appointment);
      });
    });

    callback(appointments);
  }, (error) => {
    console.error("Error listening to clinic appointments:", error);
    callback([]);
  });
};

/**
 * Get appointment by appointment key (QR code) - quick lookup
 */
export const getAppointmentByKey = async (
  clinicId: string,
  appointmentKey: string
): Promise<Appointment | null> => {
  try {
    const clinicAliases = resolveClinicIds(clinicId);

    const searchPatientQueue = async (): Promise<Appointment | null> => {
      for (const alias of clinicAliases) {
        const patientQueueRef = ref(rtdb, `patientQueue/${alias}`);
        const patientQueueSnapshot = await get(patientQueueRef);

        if (!patientQueueSnapshot.exists()) {
          continue;
        }

        const patientQueueData = patientQueueSnapshot.val() as Record<string, Record<string, Record<string, unknown>>>;

        for (const [doctorId, appointmentsById] of Object.entries(patientQueueData)) {
          for (const [appointmentId, queueRecord] of Object.entries(appointmentsById || {})) {
            if ((queueRecord as { appointmentKey?: string }).appointmentKey !== appointmentKey && appointmentId !== appointmentKey) {
              continue;
            }

            return normalizeAppointmentRecord(
              appointmentId,
              {
                ...queueRecord,
                id: appointmentId,
                appointmentId,
                doctorId: (queueRecord as { doctorId?: string }).doctorId || doctorId,
                clinicId: (queueRecord as { clinicId?: string }).clinicId || alias,
                date: (queueRecord as { date?: string }).date || '',
              },
              (queueRecord as { date?: string }).date || ''
            );
          }
        }
      }

      return null;
    };

    // First try the quick lookup index
    const indexRef = ref(rtdb, `appointmentsByKey/${appointmentKey}`);
    const indexSnapshot = await get(indexRef);
    
    if (indexSnapshot.exists()) {
      const indexData = indexSnapshot.val();
      const { date, appointmentId } = indexData;
      
      // Get the full appointment data
      for (const alias of clinicAliases) {
        const appointmentRef = ref(rtdb, `appointments/${alias}/${date}/${appointmentId}`);
        const appointmentSnapshot = await get(appointmentRef);

        if (appointmentSnapshot.exists()) {
          return normalizeAppointmentRecord(appointmentId, appointmentSnapshot.val() as Record<string, unknown>, date);
        }
      }
    }

    const queuedAppointment = await searchPatientQueue();
    if (queuedAppointment) {
      return queuedAppointment;
    }

    for (const alias of clinicAliases) {
      const summaryClinicRef = ref(rtdb, `appointmentSummaries/${alias}`);
      const summaryClinicSnapshot = await get(summaryClinicRef);

      if (summaryClinicSnapshot.exists()) {
        const summaryData = summaryClinicSnapshot.val() as Record<string, Record<string, Record<string, unknown>>>;

        for (const [date, appointmentsById] of Object.entries(summaryData)) {
          for (const [appointmentId, summaryRecord] of Object.entries(appointmentsById || {})) {
            if ((summaryRecord as { appointmentKey?: string }).appointmentKey !== appointmentKey && appointmentId !== appointmentKey) {
              continue;
            }

            const nestedAppointmentRef = ref(rtdb, `appointments/${alias}/${date}/${appointmentId}`);
            const nestedAppointmentSnapshot = await get(nestedAppointmentRef);
            if (nestedAppointmentSnapshot.exists()) {
              return normalizeAppointmentRecord(
                appointmentId,
                nestedAppointmentSnapshot.val() as Record<string, unknown>,
                date
              );
            }

            return normalizeAppointmentRecord(appointmentId, summaryRecord as Record<string, unknown>, date);
          }
        }
      }
    }

    const flatAppointmentRef = ref(rtdb, `appointments/${appointmentKey}`);
    const flatAppointmentSnapshot = await get(flatAppointmentRef);

    if (flatAppointmentSnapshot.exists()) {
      return normalizeAppointmentRecord(appointmentKey, flatAppointmentSnapshot.val() as Record<string, unknown>, '');
    }
    
    // Fallback: search by ID in case appointmentKey doesn't exist
    for (const alias of clinicAliases) {
      const appointmentsRef = ref(rtdb, `appointments/${alias}`);
      const appointmentsSnapshot = await get(appointmentsRef);
      
      if (appointmentsSnapshot.exists()) {
        const data = appointmentsSnapshot.val();
        for (const [date, dateData] of Object.entries(data)) {
          for (const [id, appointment] of Object.entries(dateData as any)) {
            if (id === appointmentKey || (appointment as any).appointmentKey === appointmentKey) {
              return normalizeAppointmentRecord(id, appointment as Record<string, unknown>, date);
            }
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error getting appointment by key:", error);
    return null;
  }
};

/**
 * Confirm appointment check-in and add to patient queue
 */
export const confirmCheckInAndAddToQueue = async (
  clinicId: string,
  appointmentId: string,
  appointment: Appointment,
  receptionistId: string
): Promise<void> => {
  try {
    const date = appointment.date;
    const doctorId = appointment.doctorId;

    if (!doctorId || !date) {
      throw new Error("Appointment missing doctorId or date");
    }

    // Get current queue number for the doctor on this date
    const queueRef = ref(rtdb, `docQueues/${clinicId}/${doctorId}/${date}`);
    const queueSnapshot = await get(queueRef);
    
    let nextQueueNumber = 1;
    if (queueSnapshot.exists()) {
      const queueData = queueSnapshot.val();
      nextQueueNumber = (queueData.currentQueueNumber || 0) + 1;
    }

    // Update appointment status to confirmed and set queue number
    const appointmentRef = ref(rtdb, `appointments/${clinicId}/${date}/${appointmentId}`);
    await update(appointmentRef, {
      status: 'confirmed',
      qrVerified: true,
      checkedInBy: receptionistId,
      checkedInAt: serverTimestamp(),
      queueNumber: nextQueueNumber,
      updatedAt: serverTimestamp()
    });

    const summaryRef = ref(rtdb, appointmentSummaryPath(clinicId, date, appointmentId));
    await update(summaryRef, {
      ...toAppointmentSummary({
        ...appointment,
        status: 'confirmed',
        checkedInAt: serverTimestamp() as any,
        queueNumber: nextQueueNumber,
        updatedAt: serverTimestamp() as any,
      },
      date),
    });

    await refreshDashboardSummary(clinicId, date);

    // Update queue counter
    await update(queueRef, {
      currentQueueNumber: nextQueueNumber,
      updatedAt: serverTimestamp()
    });

    const appointmentTime = appointment.appointmentTime || appointment.slotStartTime || '';

    const doctorAppointmentRef = ref(rtdb, doctorAppointmentsPath(clinicId, doctorId, appointmentId));
    await set(doctorAppointmentRef, stripUndefinedFields({
      clinicId,
      doctorId,
      appointmentId,
      patientId: appointment.patientId,
      patientName: appointment.patientName,
      patientPhone: appointment.patientPhone,
      doctorName: appointment.doctorName,
      date,
      appointmentDate: appointment.appointmentDate || date,
      appointmentTime,
      slotStartTime: appointment.slotStartTime || appointmentTime,
      slotEndTime: appointment.slotEndTime || appointmentTime,
      slot: appointment.slotStartTime && appointment.slotEndTime ? `${appointment.slotStartTime} - ${appointment.slotEndTime}` : appointment.slotStartTime || appointmentTime,
      appointmentKey: appointment.appointmentKey,
      queueNumber: nextQueueNumber,
      status: 'confirmed',
      qrVerified: true,
      checkedInAt: serverTimestamp(),
      checkedInBy: receptionistId,
      createdAt: appointment.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));

    // Add to patient queue with the fields the queue screens actually use.
    const patientQueueRef = ref(rtdb, `patientQueue/${clinicId}/${doctorId}/${appointmentId}`);
    const patientQueueRecord = stripUndefinedFields({
      clinicId,
      appointmentId,
      appointmentKey: appointment.appointmentKey,
      patientId: appointment.patientId,
      patientName: appointment.patientName,
      patientPhone: appointment.patientPhone,
      doctorId,
      doctorName: appointment.doctorName,
      date,
      appointmentDate: appointment.appointmentDate || date,
      appointmentTime,
      slotStartTime: appointment.slotStartTime || appointmentTime,
      slotEndTime: appointment.slotEndTime || appointmentTime,
      slot: appointment.slotStartTime && appointment.slotEndTime ? `${appointment.slotStartTime} - ${appointment.slotEndTime}` : appointment.slotStartTime || appointmentTime,
      queueNumber: nextQueueNumber,
      status: 'confirmed',
      checkedInAt: serverTimestamp(),
      checkedInBy: receptionistId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await set(patientQueueRef, patientQueueRecord);
  } catch (error) {
    console.error("Error confirming check-in:", error);
    throw error;
  }
};

/**
 * Update appointment status
 */
export const updateAppointmentStatus = async (
  clinicId: string,
  appointmentId: string,
  appointment: Appointment,
  status: AppointmentStatus
): Promise<void> => {
  try {
    const date = appointment.date || appointment.appointmentDate || '';
    const appointmentDate = appointment.appointmentDate || date;
    const appointmentTime = appointment.appointmentTime || appointment.slotStartTime || '';
    const appointmentRef = ref(rtdb, `appointments/${clinicId}/${date}/${appointmentId}`);
    const flatAppointmentRef = ref(rtdb, `appointments/${appointmentId}`);
    
    // Update payment status to 'paid' when status changes to 'confirmed'
    const updateData: any = {
      status,
      appointmentDate,
      appointmentTime,
      updatedAt: serverTimestamp()
    };
    
    if (status === 'confirmed') {
      updateData.paymentStatus = 'paid';
    }
    
    await update(appointmentRef, updateData);
    const flatUpdateData = {
      ...appointment,
      clinicId,
      date,
      appointmentDate,
      appointmentTime,
      slotStartTime: appointment.slotStartTime || appointmentTime,
      slotEndTime: appointment.slotEndTime || appointmentTime,
      status,
      paymentStatus: status === 'confirmed' ? 'paid' : (appointment.paymentStatus || 'pending'),
      updatedAt: serverTimestamp(),
    };

    await update(
      flatAppointmentRef,
      Object.fromEntries(
        Object.entries(flatUpdateData).filter(([, value]) => value !== undefined)
      )
    );

    const summaryRef = ref(rtdb, appointmentSummaryPath(clinicId, date, appointmentId));
    const summaryAppointmentTime = (appointment.slotStartTime && appointment.slotEndTime)
      ? `${appointment.slotStartTime} - ${appointment.slotEndTime}`
      : (appointment.slotStartTime || (appointment as any).appointmentTime || '');

    await update(summaryRef, stripUndefinedFields({
      status,
      patientName: appointment.patientName || '',
      appointmentTime: summaryAppointmentTime,
      paymentStatus: status === 'confirmed' ? 'paid' : (appointment.paymentStatus || 'pending'),
      updatedAt: serverTimestamp(),
    }));

    await refreshDashboardSummary(clinicId, date);

    // Also upsert the patient queue record when an appointment gets confirmed or moves into the active queue.
    if (['confirmed', 'checked_in', 'waiting', 'called', 'in_consultation'].includes(status)) {
      const patientQueueRef = ref(rtdb, `patientQueue/${clinicId}/${appointment.doctorId}/${appointmentId}`);
      const appointmentTime = appointment.appointmentTime || appointment.slotStartTime || '';
      await update(patientQueueRef, stripUndefinedFields({
        clinicId,
        appointmentId,
        appointmentKey: appointment.appointmentKey,
        patientId: appointment.patientId || '',
        patientName: appointment.patientName || '',
        patientPhone: appointment.patientPhone || '',
        doctorId: appointment.doctorId || '',
        doctorName: appointment.doctorName || '',
        date,
        appointmentDate,
        appointmentTime,
        slotStartTime: appointment.slotStartTime || appointmentTime,
        slotEndTime: appointment.slotEndTime || appointmentTime,
        slot: appointment.slotStartTime && appointment.slotEndTime ? `${appointment.slotStartTime} - ${appointment.slotEndTime}` : appointment.slotStartTime || appointmentTime,
        status,
        queueNumber: appointment.queueNumber,
        paymentStatus: status === 'confirmed' ? 'paid' : (appointment.paymentStatus || 'pending'),
        updatedAt: serverTimestamp(),
      }));
    }

    const doctorAppointmentRef = ref(rtdb, doctorAppointmentsPath(clinicId, appointment.doctorId || '', appointmentId));
    await update(doctorAppointmentRef, stripUndefinedFields({
      clinicId,
      doctorId: appointment.doctorId || '',
      appointmentId,
      patientId: appointment.patientId,
      patientName: appointment.patientName || '',
      patientPhone: appointment.patientPhone || '',
      doctorName: appointment.doctorName || '',
      date,
      appointmentDate,
      appointmentTime,
      slotStartTime: appointment.slotStartTime || appointmentTime,
      slotEndTime: appointment.slotEndTime || appointmentTime,
      slot: appointment.slotStartTime && appointment.slotEndTime ? `${appointment.slotStartTime} - ${appointment.slotEndTime}` : appointment.slotStartTime || appointmentTime,
      appointmentKey: appointment.appointmentKey,
      status,
      qrVerified: appointment.qrVerified,
      queueNumber: appointment.queueNumber,
      paymentStatus: status === 'confirmed' ? 'paid' : (appointment.paymentStatus || 'pending'),
      checkedInAt: appointment.checkedInAt,
      checkedInBy: appointment.checkedInBy,
      updatedAt: serverTimestamp(),
    }));
  } catch (error) {
    console.error("Error updating appointment status:", error);
    throw error;
  }
};

/**
 * Listen to patient queue for a specific doctor on a specific date
 */
export const listenToPatientQueue = (
  clinicId: string,
  doctorId: string,
  date: string,
  callback: (queueItems: any[]) => void
): Unsubscribe => {
  const clinicAliases = resolveClinicIds(clinicId);
  const unsubscribers: Unsubscribe[] = [];
  const sourceItems = new Map<string, any>();

  const collectQueueLeaves = (
    node: any,
    branchDoctorId: string,
    path: string[] = []
  ): any[] => {
    if (!node || typeof node !== 'object') {
      return [];
    }

    if (node.appointmentId || node.patientName || node.appointmentKey || node.date || node.slotStartTime) {
      return [{
        appointmentId: node.appointmentId || path[path.length - 1] || '',
        branchDoctorId,
        ...node,
      }];
    }

    return Object.entries(node).flatMap(([childKey, childValue]) =>
      collectQueueLeaves(childValue, branchDoctorId || childKey, [...path, childKey])
    );
  };

  const emitQueueItems = () => {
    const queueItems = Array.from(sourceItems.values())
      .filter((item) => {
        const linkedDoctorId = item.doctorId || item.branchDoctorId || '';
        const itemDate = item.date || item.appointmentDate || '';

        if (date && itemDate !== date) return false;
        if (doctorId !== 'all' && doctorId && doctorId !== linkedDoctorId) return false;
        return true;
      })
      .map((item) => ({
        ...item,
        appointmentId: item.appointmentId || item.id || '',
        doctorId: item.doctorId || item.branchDoctorId || '',
      }))
      .sort((a, b) => (a.queueNumber || 0) - (b.queueNumber || 0));

    callback(queueItems);
  };

  clinicAliases.forEach((alias) => {
    const queuePath = doctorId && doctorId !== 'all'
      ? `patientQueue/${alias}/${doctorId}`
      : `patientQueue/${alias}`;

    unsubscribers.push(onValue(ref(rtdb, queuePath), (snapshot) => {
      const data = snapshot.val();

      if (!data) {
        sourceItems.set(queuePath, []);
        emitQueueItems();
        return;
      }

      const items = doctorId && doctorId !== 'all'
        ? collectQueueLeaves(data, doctorId)
        : Object.entries(data).flatMap(([queueDoctorId, doctorQueue]: [string, any]) =>
            collectQueueLeaves(doctorQueue, queueDoctorId)
          );

      sourceItems.set(queuePath, items);
      emitQueueItems();
    }, (error) => {
      console.error('Error listening to patient queue:', error);
      sourceItems.set(queuePath, []);
      emitQueueItems();
    }));
  });

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
};

export const fetchPatientQueueSnapshot = async (
  clinicId: string,
  doctorId: string = 'all'
): Promise<Appointment[]> => {
  const clinicAliases = resolveClinicIds(clinicId);
  const queueItems: Appointment[] = [];

  const collectQueueLeaves = (
    node: any,
    branchDoctorId: string,
    path: string[] = []
  ): any[] => {
    if (!node || typeof node !== 'object') {
      return [];
    }

    if (node.appointmentId || node.patientName || node.appointmentKey || node.date || node.slotStartTime) {
      return [{
        appointmentId: node.appointmentId || path[path.length - 1] || '',
        branchDoctorId,
        ...node,
      }];
    }

    return Object.entries(node).flatMap(([childKey, childValue]) =>
      collectQueueLeaves(childValue, branchDoctorId || childKey, [...path, childKey])
    );
  };

  for (const alias of clinicAliases) {
    const snapshot = await get(ref(rtdb, doctorId && doctorId !== 'all'
      ? `patientQueue/${alias}/${doctorId}`
      : `patientQueue/${alias}`
    ));

    const data = snapshot.val();
    if (!data) continue;

    const items = doctorId && doctorId !== 'all'
      ? collectQueueLeaves(data, doctorId)
      : Object.entries(data).flatMap(([queueDoctorId, doctorQueue]: [string, any]) =>
          collectQueueLeaves(doctorQueue, queueDoctorId)
        );

    queueItems.push(...items.map((item) => ({
      ...item,
      appointmentId: item.appointmentId || item.id || '',
      doctorId: item.doctorId || item.branchDoctorId || '',
    } as Appointment)));
  }

  return queueItems.sort((a, b) => (a.queueNumber || 0) - (b.queueNumber || 0));
};

/**
 * Remove patient from queue
 */
export const removeFromPatientQueue = async (
  clinicId: string,
  doctorId: string,
  appointmentId: string
): Promise<void> => {
  try {
    const queueRef = ref(rtdb, `patientQueue/${clinicId}/${doctorId}/${appointmentId}`);
    await remove(queueRef);
  } catch (error) {
    console.error("Error removing from patient queue:", error);
    throw error;
  }
};

/**
 * Get single appointment
 */
export const getAppointment = async (
  clinicId: string,
  date: string,
  appointmentId: string
): Promise<Appointment | null> => {
  try {
    const flatAppointmentRef = ref(rtdb, `appointments/${appointmentId}`);
    const flatSnapshot = await get(flatAppointmentRef);

    if (flatSnapshot.exists()) {
      return normalizeAppointmentRecord(appointmentId, flatSnapshot.val() as Record<string, unknown>, date);
    }

    const appointmentRef = ref(rtdb, `appointments/${clinicId}/${date}/${appointmentId}`);
    const snapshot = await get(appointmentRef);
    
    if (snapshot.exists()) {
      return normalizeAppointmentRecord(appointmentId, snapshot.val() as Record<string, unknown>, date);
    }
    
    return null;
  } catch (error) {
    console.error("Error getting appointment:", error);
    return null;
  }
};

/**
 * Create new appointment
 */
export const createAppointment = async (
  clinicId: string,
  date: string,
  appointmentId: string,
  appointmentData: Omit<Appointment, 'id' | 'date'>
): Promise<void> => {
  try {
    const appointmentRef = ref(rtdb, `appointments/${clinicId}/${date}/${appointmentId}`);
    const flatAppointmentRef = ref(rtdb, `appointments/${appointmentId}`);
    const appointmentDate = appointmentData.appointmentDate || date;
    const appointmentTime = appointmentData.appointmentTime || appointmentData.slotStartTime || '';
    const normalizedAppointment = {
      ...appointmentData,
      clinicId,
      date,
      appointmentDate,
      appointmentTime,
      slotStartTime: appointmentData.slotStartTime || appointmentTime,
      slotEndTime: appointmentData.slotEndTime || appointmentTime,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await set(appointmentRef, stripUndefinedFields({
      ...normalizedAppointment,
    }));

    await set(flatAppointmentRef, stripUndefinedFields({
      ...normalizedAppointment,
    }));

    const summaryRef = ref(rtdb, appointmentSummaryPath(clinicId, date, appointmentId));
    await set(summaryRef, stripUndefinedFields({
      ...toAppointmentSummary({
        ...normalizedAppointment,
        date,
      },
      date),
      updatedAt: serverTimestamp(),
    }));

    await refreshDashboardSummary(clinicId, date);

    // Create quick lookup index if appointmentKey is provided
    if (appointmentData.appointmentKey) {
      const indexRef = ref(rtdb, `appointmentsByKey/${appointmentData.appointmentKey}`);
      await set(indexRef, stripUndefinedFields({
        clinicId,
        date,
        appointmentId,
        createdAt: serverTimestamp()
      }));
    }
  } catch (error) {
    console.error("Error creating appointment:", error);
    throw error;
  }
};
