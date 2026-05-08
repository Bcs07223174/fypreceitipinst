import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile } from '../types';

const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  
  // Check if user profile exists in Firestore
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const existingData = userDoc.data() as UserProfile | undefined;
  
  if (!userDoc.exists() || !existingData?.clinicId) {
    // For this demo, we'll auto-create/update a receptionist profile if it doesn't exist or is missing clinicId
    // In a real app, admin would create this
    const newUser: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      role: 'receptionist',
      clinicId: 'demo-clinic-1',
      status: 'active',
      profileCompleted: false,
      createdAt: serverTimestamp()
    };
    await setDoc(doc(db, 'users', user.uid), newUser);
    
    // Seed some demo doctors to the clinic if it's a new setup
    const doctor1Id = 'doc-1';
    const doctor2Id = 'doc-2';
    
    await setDoc(doc(db, 'clinics', 'demo-clinic-1', 'doctors', doctor1Id), {
      uid: doctor1Id,
      fullName: 'Dr. Ahmad Khan',
      specialization: 'Cardiologist',
      roomNumber: 'Room 101',
      status: 'active',
      createdAt: serverTimestamp()
    });
    
    await setDoc(doc(db, 'clinics', 'demo-clinic-1', 'doctors', doctor2Id), {
      uid: doctor2Id,
      fullName: 'Dr. Sarah Smith',
      specialization: 'Pediatrician',
      roomNumber: 'Room 203',
      status: 'active',
      createdAt: serverTimestamp()
    });

    // Also create the receptionist record under the clinic
    await setDoc(doc(db, 'clinics', 'demo-clinic-1', 'receptionists', user.uid), {
      uid: user.uid,
      clinicId: 'demo-clinic-1',
      fullName: user.displayName || 'Demo Receptionist',
      email: user.email || '',
      assignedDoctorIds: [doctor1Id, doctor2Id], // Auto-assign these doctors
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Seed one demo appointment for today
    const appointmentId = 'demo-apt-1';
    const today = new Date().toISOString().split('T')[0];
    await setDoc(doc(db, 'appointments', appointmentId), {
      id: appointmentId,
      patientId: 'demo-patient-1',
      patientName: 'Ali Jawad (Demo)',
      patientPhone: '+92 300 1234567',
      doctorId: doctor1Id,
      doctorName: 'Dr. Ahmad Khan',
      clinicId: 'demo-clinic-1',
      date: today,
      slotStartTime: '09:00 AM',
      slotEndTime: '09:15 AM',
      status: 'pending', // Change from confirmed to pending so it shows up
      qrVerified: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
  
  return user;
};

export const logout = () => signOut(auth);

export const observeAuth = (callback: (user: FirebaseUser | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const userDoc = await getDoc(doc(db, 'users', uid));
  return userDoc.exists() ? (userDoc.data() as UserProfile) : null;
};
