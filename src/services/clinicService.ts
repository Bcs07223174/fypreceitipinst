import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  serverTimestamp,
  runTransaction,
  onSnapshot,
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { Appointment, DoctorProfile, ReceptionistProfile } from '../types';

const normalizeDoctorIds = (data: any): string[] => {
  const source = Array.isArray(data?.linked_doctor_ids)
    ? data.linked_doctor_ids
    : Array.isArray(data?.assignedDoctorIds)
      ? data.assignedDoctorIds
      : Array.isArray(data?.linkedDoctorIds)
        ? data.linkedDoctorIds
        : [];

  return source.map(String).map((id) => id.trim()).filter(Boolean);
};

const normalizeReceptionistProfile = (
  data: Record<string, any>,
  fallbackUid: string,
  clinicId: string
): ReceptionistProfile => ({
  ...(data as ReceptionistProfile),
  uid:
    typeof data?.firebaseUid === 'string' && data.firebaseUid.trim()
      ? data.firebaseUid.trim()
      : fallbackUid,
  clinicId:
    typeof data?.clinicId === 'string' && data.clinicId.trim()
      ? data.clinicId.trim()
      : clinicId,
  assignedDoctorIds: normalizeDoctorIds(data)
});

export const getReceptionistProfile = async (clinicId: string, uid: string): Promise<ReceptionistProfile | null> => {
  const path = `clinics/${clinicId}/receptionists/${uid}`;
  try {
    const directDoc = await getDoc(doc(db, path));
    if (directDoc.exists()) {
      return normalizeReceptionistProfile(directDoc.data() as Record<string, any>, uid, clinicId);
    }

    const fallbackQuery = query(
      collection(db, `clinics/${clinicId}/receptionists`),
      where('firebaseUid', '==', uid),
      limit(1)
    );
    const fallbackSnapshot = await getDocs(fallbackQuery);
    if (!fallbackSnapshot.empty) {
      return normalizeReceptionistProfile(
        fallbackSnapshot.docs[0].data() as Record<string, any>,
        uid,
        clinicId
      );
    }

    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const getAssignedDoctors = async (clinicId: string, doctorIds: string[]): Promise<DoctorProfile[]> => {
  if (doctorIds.length === 0) return [];
  const path = `clinics/${clinicId}/doctors`;
  try {
    const q = query(collection(db, path), where('uid', 'in', doctorIds));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as DoctorProfile);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const getAppointmentsByDate = (
  clinicId: string, 
  date: string, 
  doctorIds: string[], 
  callback: (appointments: Appointment[]) => void
) => {
  if (!clinicId || !date) {
    console.warn("getAppointmentsByDate called with missing clinicId or date:", { clinicId, date });
    callback([]);
    return () => {};
  }
  const path = `appointments`;
  // Simplify query to just clinicId and date to avoid common index issues
  // Doctor filtering will be done locally
  const q = query(
    collection(db, path), 
    where('clinicId', '==', clinicId)
  );
  
  return onSnapshot(q, (snapshot) => {
    let appointments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
    
    // Filter by date locally to avoid composite index requirement
    appointments = appointments.filter(app => app.date === date);
    
    // Filter by assigned doctors locally if any are assigned
    if (doctorIds.length > 0) {
      appointments = appointments.filter(app => doctorIds.includes(app.doctorId));
    }
    
    callback(appointments);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
};

export const approveCheckIn = async (clinicId: string, appointmentId: string, receptionistId: string) => {
  if (!clinicId || !appointmentId) {
    throw new Error("Missing clinicId or appointmentId");
  }
  const path = `appointments/${appointmentId}`;
  try {
    await runTransaction(db, async (transaction) => {
      const appRef = doc(db, path);
      const appSnap = await transaction.get(appRef);
      if (!appSnap.exists()) throw new Error("Appointment not found");
      
      const appData = appSnap.data() as Appointment;
      const doctorId = appData.doctorId;
      const date = appData.date || new Date().toISOString().split('T')[0];
      
      if (!doctorId) throw new Error("Appointment missing doctorId");
      
      // Get/Update Queue Number
      const queuePath = `clinics/${clinicId}/doctorQueues`;
      const queueDocId = `${doctorId}_${date}`;
      const queueCounterRef = doc(db, queuePath, queueDocId);
      const queueSnap = await transaction.get(queueCounterRef);
      let nextQueueNumber = 1;
      
      if (queueSnap.exists()) {
        nextQueueNumber = queueSnap.data().currentQueueNumber + 1;
        transaction.update(queueCounterRef, { currentQueueNumber: nextQueueNumber, updatedAt: serverTimestamp() });
      } else {
        transaction.set(queueCounterRef, { 
          doctorId, 
          date, 
          currentQueueNumber: 1, 
          updatedAt: serverTimestamp() 
        });
      }
      
      transaction.update(appRef, {
        status: 'confirmed', // Updated to confirmed as per user flow
        qrVerified: true,
        checkedInBy: receptionistId,
        checkedInAt: serverTimestamp(),
        queueNumber: nextQueueNumber,
        updatedAt: serverTimestamp()
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const updateAppointmentStatus = async (clinicId: string, appointmentId: string, status: string) => {
  const path = `appointments/${appointmentId}`;
  try {
    await updateDoc(doc(db, path), {
      status,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};
