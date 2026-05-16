import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { collection, collectionGroup, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile } from '../types';

const googleProvider = new GoogleAuthProvider();

const PROFILE_NOT_FOUND_ERROR =
  'Receptionist profile not found. Please ask admin to create and link your account.';

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

type ResolvedReceptionist = {
  profile: UserProfile;
  userProfile: Record<string, any> | null;
  receptionistData: Record<string, any>;
  path: string;
  clinicId: string;
  normalizedAssignedDoctorIds: string[];
};

const resolveReceptionistProfile = async (
  uid: string,
  emailFallback: string
): Promise<ResolvedReceptionist | null> => {
  const userDoc = await getDoc(doc(db, 'users', uid));
  const userProfile = userDoc.exists() ? (userDoc.data() as Record<string, any>) : null;
  console.log('users/{uid} profile:', userProfile);

  const userClinicId =
    typeof userProfile?.clinicId === 'string' && userProfile.clinicId.trim()
      ? userProfile.clinicId.trim()
      : '';

  let receptionistData: Record<string, any> | null = null;
  let clinicId = userClinicId;
  let path = '';

  if (clinicId) {
    path = `clinics/${clinicId}/receptionists/${uid}`;
    const directDoc = await getDoc(doc(db, path));
    if (directDoc.exists()) {
      receptionistData = directDoc.data() as Record<string, any>;
    } else {
      const fallbackQuery = query(
        collection(db, `clinics/${clinicId}/receptionists`),
        where('firebaseUid', '==', uid),
        limit(1)
      );
      const fallbackSnapshot = await getDocs(fallbackQuery);
      if (!fallbackSnapshot.empty) {
        const fallbackDoc = fallbackSnapshot.docs[0];
        receptionistData = fallbackDoc.data() as Record<string, any>;
        path = fallbackDoc.ref.path;
      }
    }
  }

  if (!receptionistData) {
    try {
      const groupQuery = query(
        collectionGroup(db, 'receptionists'),
        where('firebaseUid', '==', uid),
        limit(1)
      );
      const groupSnapshot = await getDocs(groupQuery);
      if (!groupSnapshot.empty) {
        const groupDoc = groupSnapshot.docs[0];
        receptionistData = groupDoc.data() as Record<string, any>;
        clinicId = groupDoc.ref.parent.parent?.id || clinicId;
        path = groupDoc.ref.path;
      }
    } catch (error) {
      console.warn('collectionGroup lookup for receptionists failed:', error);
    }
  }

  if (!receptionistData || !clinicId) {
    return null;
  }

  const normalizedAssignedDoctorIds = normalizeDoctorIds(receptionistData);
  const resolvedProfile: UserProfile = {
    uid,
    firebaseUid: typeof receptionistData.firebaseUid === 'string' && receptionistData.firebaseUid.trim()
      ? receptionistData.firebaseUid.trim()
      : uid,
    email:
      typeof receptionistData.email === 'string' && receptionistData.email.trim()
        ? receptionistData.email.trim()
        : emailFallback,
    role: (receptionistData.role || userProfile?.role || 'receptionist') as UserProfile['role'],
    clinicId,
    status: (receptionistData.status || userProfile?.status || 'active') as UserProfile['status'],
    profileCompleted: Boolean(userProfile?.profileCompleted ?? true),
    createdAt: receptionistData.createdAt || userProfile?.createdAt || null,
    assignedDoctorIds: normalizedAssignedDoctorIds
  };

  return {
    profile: resolvedProfile,
    userProfile,
    receptionistData,
    path,
    clinicId,
    normalizedAssignedDoctorIds
  };
};

export const loginWithGoogle = async () => {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;

  console.log('Auth UID:', user.uid);
  const resolved = await resolveReceptionistProfile(user.uid, user.email || '');

  if (!resolved) {
    await signOut(auth);
    throw new Error(PROFILE_NOT_FOUND_ERROR);
  }

  console.log('Resolved receptionist path:', resolved.path);
  console.log('Raw receptionist data:', resolved.receptionistData);
  console.log('linked_doctor_ids count:', resolved.receptionistData?.linked_doctor_ids?.length);
  console.log('normalized assignedDoctorIds count:', resolved.normalizedAssignedDoctorIds.length);

  return user;
};

export const logout = () => signOut(auth);

export const observeAuth = (callback: (user: FirebaseUser | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const resolved = await resolveReceptionistProfile(uid, auth.currentUser?.email || '');

  if (!resolved) {
    return null;
  }

  console.log('Resolved receptionist path:', resolved.path);
  console.log('Raw receptionist data:', resolved.receptionistData);
  console.log('linked_doctor_ids count:', resolved.receptionistData?.linked_doctor_ids?.length);
  console.log('normalized assignedDoctorIds count:', resolved.normalizedAssignedDoctorIds.length);

  return resolved.profile;
};
