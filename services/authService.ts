import { 
  signInWithPopup, 
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { toLocalDateKey } from '../lib/date';
import { UserProfile } from '../types';
import { createAppointment } from './realtimeDatabaseService';

const googleProvider = new GoogleAuthProvider();

const mapReceptionistRecordToUserProfile = (uid: string, data: Record<string, any> | null | undefined): UserProfile | null => {
  if (!data) {
    return null;
  }

  return {
    uid,
    email: data.email || '',
    role: 'receptionist',
    clinicId: data.clinicId || 'demo-clinic-1',
    status: data.status || 'active',
    profileCompleted: Boolean(data.profileCompleted),
    createdAt: data.createdAt || serverTimestamp(),
  };
};

const getReceptionistProfileForAuth = async (uid: string) => {
  const topLevelDoc = await getDoc(doc(db, 'receptionists', uid));
  if (topLevelDoc.exists()) {
    return topLevelDoc.data() as Record<string, any>;
  }

  const byFirebaseUid = await getDocs(query(collection(db, 'receptionists'), where('firebaseUid', '==', uid)));
  if (!byFirebaseUid.empty) {
    return byFirebaseUid.docs[0].data() as Record<string, any>;
  }

  return null;
};

// Google Sign In
export const loginWithGoogle = async () => {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;

  const receptionistProfile = await getReceptionistProfileForAuth(user.uid);
  
  // Check if user profile exists in Firestore
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const existingData = userDoc.data() as UserProfile | undefined;
  
  if (!userDoc.exists() || !existingData?.clinicId || !receptionistProfile) {
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
      firebaseUid: user.uid,
      clinicId: 'demo-clinic-1',
      fullName: user.displayName || 'Demo Receptionist',
      email: user.email || '',
      photoUrl: user.photoURL || '',
      linked_doctor_ids: [doctor1Id],
      assignedDoctorIds: [doctor1Id], // Auto-assign the primary demo doctor
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    await setDoc(doc(db, 'receptionists', user.uid), {
      uid: user.uid,
      firebaseUid: user.uid,
      clinicId: 'demo-clinic-1',
      fullName: user.displayName || 'Demo Receptionist',
      name: user.displayName || 'Demo Receptionist',
      email: user.email || '',
      photoUrl: user.photoURL || '',
      linked_doctor_ids: [doctor1Id],
      assignedDoctorIds: [doctor1Id],
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    await setDoc(doc(db, 'doctors', doctor1Id), {
      uid: doctor1Id,
      doctorId: doctor1Id,
      doctorName: 'Dr. Ahmad Khan',
      name: 'Dr. Ahmad Khan',
      fullName: 'Dr. Ahmad Khan',
      specialization: 'Cardiologist',
      roomNumber: 'Room 101',
      status: 'active',
      createdAt: serverTimestamp()
    });

    await setDoc(doc(db, 'doctors', doctor2Id), {
      uid: doctor2Id,
      doctorId: doctor2Id,
      doctorName: 'Dr. Sarah Smith',
      name: 'Dr. Sarah Smith',
      fullName: 'Dr. Sarah Smith',
      specialization: 'Pediatrician',
      roomNumber: 'Room 203',
      status: 'active',
      createdAt: serverTimestamp()
    });

    // Seed one demo appointment for today
    const appointmentId = 'demo-apt-1';
    const today = toLocalDateKey(new Date());
    await createAppointment('demo-clinic-1', today, appointmentId, {
      patientId: 'demo-patient-1',
      patientName: 'Ali Jawad (Demo)',
      patientPhone: '+92 300 1234567',
      doctorId: doctor1Id,
      doctorName: 'Dr. Ahmad Khan',
      clinicId: 'demo-clinic-1',
      slotStartTime: '09:00 AM',
      slotEndTime: '09:15 AM',
      status: 'pending', // Change from confirmed to pending so it shows up
      qrVerified: false,
      appointmentKey: 'demo-apt-1-key',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
  
  return user;
};

// Email/Password Sign Up
export const signUpWithEmail = async (email: string, password: string, fullName: string, clinicId: string = 'demo-clinic-1') => {
  if (!email || !password || password.length < 6) {
    throw new Error('Email and password (min 6 characters) are required');
  }

  const result = await createUserWithEmailAndPassword(auth, email, password);
  const user = result.user;

  // Create user profile in Firestore
  const newUser: UserProfile = {
    uid: user.uid,
    email: email,
    role: 'receptionist',
    clinicId: clinicId,
    status: 'active',
    profileCompleted: false,
    createdAt: serverTimestamp()
  };
  
  await setDoc(doc(db, 'users', user.uid), newUser);

  // Create receptionist profile under the clinic
  await setDoc(doc(db, 'receptionists', user.uid), {
    uid: user.uid,
    firebaseUid: user.uid,
    clinicId: clinicId,
    fullName: fullName,
    name: fullName,
    email: email,
    photoUrl: user.photoURL || '',
    linked_doctor_ids: [],
    assignedDoctorIds: [],
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await setDoc(doc(db, 'clinics', clinicId, 'receptionists', user.uid), {
    uid: user.uid,
    firebaseUid: user.uid,
    clinicId: clinicId,
    fullName: fullName,
    name: fullName,
    email: email,
    photoUrl: user.photoURL || '',
    linked_doctor_ids: [],
    assignedDoctorIds: [],
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return user;
};

// Email/Password Sign In
export const loginWithEmail = async (email: string, password: string) => {
  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
};

// Send Password Reset Email
export const sendResetPasswordEmail = async (email: string) => {
  if (!email) {
    throw new Error('Email is required');
  }

  try {
    await sendPasswordResetEmail(auth, email);
    return true;
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      throw new Error('No account found with this email address');
    }
    throw error;
  }
};

// Doctor Sign Up
export const signUpDoctorWithEmail = async (
  email: string, 
  password: string, 
  fullName: string,
  specialization: string,
  roomNumber: string,
  clinicId: string = 'demo-clinic-1'
) => {
  if (!email || !password || password.length < 6) {
    throw new Error('Email and password (min 6 characters) are required');
  }

  const result = await createUserWithEmailAndPassword(auth, email, password);
  const user = result.user;

  // Create user profile in Firestore
  const newUser: UserProfile = {
    uid: user.uid,
    email: email,
    role: 'doctor',
    clinicId: clinicId,
    status: 'active',
    profileCompleted: false,
    createdAt: serverTimestamp()
  };
  
  await setDoc(doc(db, 'users', user.uid), newUser);

  // Create doctor profile under the clinic
  await setDoc(doc(db, 'doctors', user.uid), {
    uid: user.uid,
    firebaseUid: user.uid,
    doctorId: user.uid,
    doctorName: fullName,
    name: fullName,
    fullName: fullName,
    specialization: specialization,
    roomNumber: roomNumber,
    status: 'active',
    email: email,
    photoUrl: user.photoURL || '',
    createdAt: serverTimestamp()
  });

  await setDoc(doc(db, 'clinics', clinicId, 'doctors', user.uid), {
    uid: user.uid,
    firebaseUid: user.uid,
    doctorId: user.uid,
    doctorName: fullName,
    name: fullName,
    fullName: fullName,
    specialization: specialization,
    roomNumber: roomNumber,
    status: 'active',
    email: email,
    photoUrl: user.photoURL || '',
    createdAt: serverTimestamp()
  });

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

export const resolveAuthenticatedUserProfile = async (
  uid: string,
  _email?: string | null
): Promise<UserProfile | null> => {
  const receptionistRecord = await getReceptionistProfileForAuth(uid);
  if (receptionistRecord) {
    return mapReceptionistRecordToUserProfile(uid, receptionistRecord);
  }

  const userProfile = await getUserProfile(uid);
  if (!userProfile) {
    return null;
  }

  if (userProfile.clinicId) {
    return userProfile;
  }

  return userProfile;
};
