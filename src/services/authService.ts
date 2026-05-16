import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile } from '../types';

const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const existingData = userDoc.data() as UserProfile | undefined;

  if (!userDoc.exists() || !existingData) {
    await signOut(auth);
    throw new Error('Access denied: your account has not been set up. Please contact your clinic administrator.');
  }

  if (existingData.role !== 'receptionist') {
    await signOut(auth);
    throw new Error('Access denied: only receptionist accounts can use this portal.');
  }

  if (!existingData.clinicId) {
    await signOut(auth);
    throw new Error('Access denied: your account is not assigned to a clinic. Please contact your administrator.');
  }

  if (existingData.status !== 'active') {
    await signOut(auth);
    throw new Error('Access denied: your account is inactive. Please contact your administrator.');
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
