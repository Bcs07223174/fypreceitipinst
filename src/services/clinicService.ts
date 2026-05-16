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
  onSnapshot
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { Appointment, DoctorProfile, ReceptionistProfile } from '../types';

export const getReceptionistProfile = async (clinicId: string, uid: string): Promise<ReceptionistProfile | null> => {
  const path = `clinics/${clinicId}/receptionists/${uid}`;
  try {
    const docSnap = await getDoc(doc(db, path));
    return docSnap.exists() ? (docSnap.data() as ReceptionistProfile) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const getAssignedDoctors = async (clinicId: string, doctorIds: string[]): Promise<DoctorProfile[]> => {
  if (doctorIds.length === 0) return [];
  const path = `clinics/${clinicId}/doctors`;
  try {
    const chunks: string[][] = [];
    for (let i = 0; i < doctorIds.length; i += 10) {
      chunks.push(doctorIds.slice(i, i + 10));
    }

    const snapshots = await Promise.all(
      chunks.map((chunk) => getDocs(query(collection(db, path), where('uid', 'in', chunk))))
    );

    return snapshots.flatMap((querySnapshot) => querySnapshot.docs.map((docSnap) => docSnap.data() as DoctorProfile));
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
  const q = query(
    collection(db, path), 
    where('clinicId', '==', clinicId),
    where('date', '==', date)
  );
  
  return onSnapshot(q, (snapshot) => {
    let appointments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));

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
