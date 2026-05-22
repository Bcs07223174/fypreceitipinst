import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { Appointment, DoctorProfile, ReceptionistProfile, AppointmentStatus, DashboardDailySummary } from '../types';
import {
  listenToAppointmentsByClinicAndDate,
  confirmCheckInAndAddToQueue,
  updateAppointmentStatus as updateRTDBAppointmentStatus,
  listenToPatientQueue,
  fetchPatientQueueSnapshot,
  createAppointment,
  getAppointmentByKey,
  listenToDashboardSummary,
  refreshDashboardSummary,
} from './realtimeDatabaseService';

const normalizeDoctorIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((doctorId) => String(doctorId).trim())
    .filter(Boolean);
};

const normalizeText = (value: unknown): string => String(value ?? '').trim().toLowerCase();

const normalizeDoctorRecord = (docSnap: { id: string; data: () => Record<string, unknown> }) => {
  const doctor = docSnap.data() as Record<string, unknown> & {
    firebaseUid?: string;
    doctorId?: string;
    doctorName?: string;
    name?: string;
    fullName?: string;
    photoUrl?: string;
    profileImageUrl?: string;
  };

  const fullName = String(doctor.fullName || doctor.name || doctor.doctorName || '').trim();
  const profileImageUrl = String(doctor.profileImageUrl || doctor.photoUrl || '').trim();

  return {
    uid: String(doctor.uid || docSnap.id),
    firebaseUid: doctor.firebaseUid,
    doctorId: String(doctor.doctorId || doctor.uid || docSnap.id),
    fullName,
    name: String(doctor.name || fullName),
    doctorName: String(doctor.doctorName || fullName),
    specialization: String(doctor.specialization || ''),
    roomNumber: String(doctor.roomNumber || ''),
    status: String(doctor.status || 'active'),
    email: String(doctor.email || ''),
    photoUrl: String(doctor.photoUrl || ''),
    profileImageUrl,
    createdAt: doctor.createdAt,
  } as DoctorProfile;
};

const getLinkedDoctorIds = (
  clinicData: Record<string, unknown> | null | undefined,
  userData: Record<string, unknown> | null | undefined
): string[] => {
  const preferredSources = [
    clinicData?.linked_doctor_ids,
    userData?.linked_doctor_ids,
    clinicData?.assignedDoctorIds,
    userData?.assignedDoctorIds,
    clinicData?.linkedDoctorIds,
    userData?.linkedDoctorIds,
  ];

  for (const source of preferredSources) {
    const normalized = normalizeDoctorIds(source);
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return [];
};

export const getReceptionistProfile = async (clinicId: string, uid: string): Promise<ReceptionistProfile | null> => {
  try {
    const topLevelById = await getDoc(doc(db, 'receptionists', uid));
    const topLevelByFirebaseUid = topLevelById.exists()
      ? null
      : await getDocs(query(collection(db, 'receptionists'), where('firebaseUid', '==', uid)));
    const topLevelByFirebaseUidDocs = topLevelByFirebaseUid?.docs ?? [];

    const topLevelData = topLevelById.exists()
      ? topLevelById.data()
      : (topLevelByFirebaseUidDocs[0]?.data() ?? null);

    const clinicSnap = await getDoc(doc(db, 'clinics', clinicId, 'receptionists', uid));
    const clinicData = clinicSnap.exists() ? clinicSnap.data() : null;
    const userSnap = await getDoc(doc(db, 'users', uid));
    const userData = userSnap.exists() ? userSnap.data() : null;

    const assignedDoctorIds = getLinkedDoctorIds(
      (topLevelData || clinicData) as Record<string, unknown> | null,
      userData as Record<string, unknown> | null
    );

    if (!topLevelData && !clinicData && !userData) {
      return null;
    }

    return {
      ...(topLevelData || clinicData || {}),
      uid,
      firebaseUid: (topLevelData as Record<string, unknown> | null)?.firebaseUid || uid,
      clinicId: (topLevelData as Record<string, unknown> | null)?.clinicId || clinicData?.clinicId || clinicId,
      email: (topLevelData as Record<string, unknown> | null)?.email || userData?.email || clinicData?.email || '',
      fullName: (topLevelData as Record<string, unknown> | null)?.fullName || (topLevelData as Record<string, unknown> | null)?.name || clinicData?.fullName || userData?.name || clinicData?.name || '',
      phone: (topLevelData as Record<string, unknown> | null)?.phone || clinicData?.phone || userData?.phone || '',
      gender: String((topLevelData as Record<string, unknown> | null)?.gender || clinicData?.gender || 'Other'),
      shift: String((topLevelData as Record<string, unknown> | null)?.shift || clinicData?.shift || 'Morning'),
      profileImageUrl: String((topLevelData as Record<string, unknown> | null)?.profileImageUrl || (topLevelData as Record<string, unknown> | null)?.photoUrl || clinicData?.profileImageUrl || clinicData?.photoUrl || userData?.photoUrl || ''),
      photoUrl: String((topLevelData as Record<string, unknown> | null)?.photoUrl || clinicData?.photoUrl || userData?.photoUrl || ''),
      linked_doctor_ids: assignedDoctorIds,
      assignedDoctorIds,
      status: String((topLevelData as Record<string, unknown> | null)?.status || clinicData?.status || userData?.status || 'active'),
      createdAt: (topLevelData as Record<string, unknown> | null)?.createdAt || clinicData?.createdAt || userData?.createdAt,
      updatedAt: (topLevelData as Record<string, unknown> | null)?.updatedAt || clinicData?.updatedAt || userData?.updatedAt || null,
      address: (topLevelData as Record<string, unknown> | null)?.address || clinicData?.address,
    } as ReceptionistProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `receptionists/${uid} or clinics/${clinicId}/receptionists/${uid}`);
    return null;
  }
};

export const getLinkedDoctorIdsForReceptionist = async (clinicId: string, uid: string): Promise<string[]> => {
  const profile = await getReceptionistProfile(clinicId, uid);
  return profile?.assignedDoctorIds || [];
};

export const getReceptionists = async (clinicId: string): Promise<ReceptionistProfile[]> => {
  const path = `receptionists`;
  try {
    const receptionistSnap = await getDocs(collection(db, path));

    return receptionistSnap.docs.map(docSnap => {
      const receptionist = docSnap.data() as Partial<ReceptionistProfile>;
      const receptionistName = (receptionist as Partial<ReceptionistProfile> & { name?: string }).name;
      const assignedDoctorIds = getLinkedDoctorIds(receptionist as Record<string, unknown>, null);
      if (clinicId && receptionist.clinicId && receptionist.clinicId !== clinicId) {
        return null;
      }
      return {
        uid: receptionist.uid || docSnap.id,
        firebaseUid: receptionist.firebaseUid,
        clinicId: receptionist.clinicId || clinicId,
        fullName: receptionist.fullName || receptionistName || '',
        email: receptionist.email || '',
        photoUrl: receptionist.photoUrl || '',
        phone: receptionist.phone || '',
        gender: receptionist.gender || 'Other',
        shift: receptionist.shift || 'Morning',
        profileImageUrl: receptionist.profileImageUrl || '',
        assignedDoctorIds,
        linked_doctor_ids: assignedDoctorIds,
        status: receptionist.status || 'active',
        createdAt: receptionist.createdAt,
        updatedAt: receptionist.updatedAt,
        address: receptionist.address,
      } as ReceptionistProfile;
    }).filter((item): item is ReceptionistProfile => Boolean(item));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const getAssignedDoctors = async (clinicId: string, doctorIds: string[]): Promise<DoctorProfile[]> => {
  if (doctorIds.length === 0) return [];
  try {
    const doctorsById = new Map<string, DoctorProfile>();
    const doctorLookups = [
      getDocs(collection(db, 'doctors')),
      getDocs(collection(db, `clinics/${clinicId}/doctors`)),
    ];

    const addDoctor = (docSnap: any) => {
      const doctor = normalizeDoctorRecord(docSnap);
      const identifiers = [
        doctor.uid,
        doctor.firebaseUid,
        doctor.doctorId,
        doctor.fullName,
        doctor.name,
        doctor.doctorName,
      ].filter(Boolean).map(normalizeText);

      const requestedIds = doctorIds.map(normalizeText);
      const matches = identifiers.some(identifier => requestedIds.includes(identifier));

      if (matches) {
        const canonicalId = doctor.uid || docSnap.id;
        if (!doctorsById.has(canonicalId)) {
          doctorsById.set(canonicalId, { ...doctor, uid: canonicalId });
        }
      }
    };

    const snapshots = await Promise.all(doctorLookups);
    snapshots.forEach(snapshot => {
      snapshot.docs.forEach(addDoctor);
    });

    const uniqueDoctorIds = [...new Set(doctorIds)].filter(Boolean);
    const resolvedDoctors = uniqueDoctorIds
      .map(id => doctorsById.get(id))
      .filter((doctor): doctor is DoctorProfile => Boolean(doctor));

    if (resolvedDoctors.length !== uniqueDoctorIds.length) {
      const missingDoctorIds = uniqueDoctorIds.filter(id => !doctorsById.has(id));
      console.warn('Missing linked doctor documents in clinic doctors collection:', {
        clinicId,
        missingDoctorIds,
        linkedDoctorCount: uniqueDoctorIds.length,
        resolvedDoctorCount: resolvedDoctors.length,
      });
    }

    return resolvedDoctors;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `doctors or clinics/${clinicId}/doctors`);
    return [];
  }
};

export const getClinicDoctors = async (clinicId: string): Promise<DoctorProfile[]> => {
  const path = `clinics/${clinicId}/doctors`;
  try {
    const doctorsSnapshot = await getDocs(collection(db, path));
    return doctorsSnapshot.docs.map((docSnap) => ({
      ...(docSnap.data() as DoctorProfile),
      uid: docSnap.id,
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

/**
 * Get appointments by clinic and date with real-time updates from RTDB
 */
export const getAppointmentsByDate = (
  clinicId: string, 
  date: string, 
  doctorIds: string[], 
  callback: (appointments: Appointment[]) => void
) => {
  // RTDB listeners expect the date key to already be normalized to yyyy-MM-dd.
  // Doctor filtering is applied safely in the RTDB layer; an empty doctorIds list means "no doctor restriction".
  return listenToAppointmentsByClinicAndDate(clinicId, date, doctorIds, callback);
};

/**
 * Get appointment by key (QR code) for quick lookup
 */
export const getAppointmentByKeyFromRTDB = async (
  clinicId: string,
  appointmentKey: string
): Promise<Appointment | null> => {
  return getAppointmentByKey(clinicId, appointmentKey);
};

/**
 * Approve check-in and add patient to queue
 */
export const approveCheckIn = async (
  clinicId: string, 
  appointmentId: string, 
  appointment: Appointment,
  receptionistId: string
) => {
  if (!clinicId || !appointmentId) {
    throw new Error("Missing clinicId or appointmentId");
  }
  
  try {
    await confirmCheckInAndAddToQueue(clinicId, appointmentId, appointment, receptionistId);
  } catch (error) {
    console.error("Error approving check-in:", error);
    throw error;
  }
};

/**
 * Update appointment status in RTDB
 */
export const updateAppointmentStatus = async (
  clinicId: string, 
  appointmentId: string, 
  appointment: Appointment,
  status: AppointmentStatus
) => {
  try {
    await updateRTDBAppointmentStatus(clinicId, appointmentId, appointment, status);
  } catch (error) {
    console.error("Error updating appointment status:", error);
    throw error;
  }
};

/**
 * Listen to patient queue for a specific doctor
 */
export const listenToClinicPatientQueue = (
  clinicId: string,
  doctorId: string,
  date: string,
  callback: (queueItems: any[]) => void
) => {
  return listenToPatientQueue(clinicId, doctorId, date, callback);
};

export const fetchClinicPatientQueue = async (
  clinicId: string,
  doctorId: string = 'all'
): Promise<Appointment[]> => {
  return fetchPatientQueueSnapshot(clinicId, doctorId);
};

export const getDashboardSummary = (
  clinicId: string,
  date: string,
  callback: (summary: DashboardDailySummary) => void
) => {
  return listenToDashboardSummary(clinicId, date, callback);
};

export const rebuildDashboardSummary = async (
  clinicId: string,
  date: string
): Promise<void> => {
  await refreshDashboardSummary(clinicId, date);
};

