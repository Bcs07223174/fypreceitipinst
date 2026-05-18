import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';

import { observeAuth, resolveAuthenticatedUserProfile, logout } from '../services/authService';
import { UserProfile } from '../types';

const LoginPage = lazy(() => import('../views/receptionist/LoginPage'));
const Dashboard = lazy(() => import('../views/receptionist/Dashboard'));
const QRScannerPage = lazy(() => import('../views/receptionist/QRScannerPage'));
const AppointmentList = lazy(() => import('../views/receptionist/AppointmentList'));
const QueueManagement = lazy(() => import('../views/receptionist/QueueManagement'));
const ProfilePage = lazy(() => import('../views/receptionist/ProfilePage'));
const Layout = lazy(() => import('./Layout'));
const DebugPage = lazy(() => import('../views/DebugPage'));
const DoctorReceptionPage = lazy(() => import('../views/doctor/DoctorReceptionPage'));

function RouteFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-white">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-300 border-t-sky-600" />
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const fallbackProfile = user
    ? {
        uid: user.uid,
        email: user.email || '',
        role: 'receptionist' as const,
        clinicId: 'demo-clinic-1',
        status: 'active' as const,
        profileCompleted: false,
        createdAt: null,
      }
    : null;
  const activeProfile = profile || fallbackProfile;

  useEffect(() => {
    const unsubscribe = observeAuth(async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);

      try {
        if (firebaseUser) {
          setProfileLoading(true);
          const userProfile = await resolveAuthenticatedUserProfile(firebaseUser.uid, firebaseUser.email);
          setProfile(userProfile);
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error('Auth observer error:', err);
        setProfile(null);
      } finally {
        setProfileLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-sky-500 border-t-transparent shadow-lg shadow-sky-100" />
      </div>
    );
  }

  return (
    <Router>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/debug" element={<DebugPage />} />

          <Route
            path="/login"
            element={
              !user ? (
                <LoginPage />
              ) : activeProfile?.role === 'doctor' ? (
                <Navigate to="/doctor/appointments" replace />
              ) : (
                <Navigate to="/receptionist/dashboard" replace />
              )
            }
          />

          {/* Receptionist Routes */}
          <Route
            element={
              user && activeProfile?.role === 'receptionist' ? (
                <Layout profile={activeProfile} />
              ) : user && activeProfile?.role === 'doctor' ? (
                <Navigate to="/doctor/appointments" replace />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          >
            <Route path="/" element={<Dashboard profile={activeProfile} />} />
            <Route
              path="/receptionist/dashboard"
              element={<Dashboard profile={activeProfile} />}
            />
            <Route path="/scan" element={<QRScannerPage profile={activeProfile} />} />
            <Route
              path="/appointments"
              element={<AppointmentList profile={activeProfile} />}
            />
            <Route path="/queue" element={<QueueManagement profile={activeProfile} />} />
            <Route path="/profile" element={<ProfilePage profile={activeProfile} />} />
          </Route>

          {/* Doctor Routes */}
          <Route
            path="/doctor/appointments"
            element={
              user && activeProfile?.role === 'doctor' ? (
                <DoctorReceptionPage profile={activeProfile} />
              ) : user && activeProfile?.role === 'receptionist' ? (
                <Navigate to="/receptionist/dashboard" replace />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          {/* Catch-all Route */}
          <Route
            path="*"
            element={
              user ? (
                activeProfile?.role === 'doctor' ? (
                  <Navigate to="/doctor/appointments" replace />
                ) : (
                  <Navigate to="/receptionist/dashboard" replace />
                )
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>
      </Suspense>
    </Router>
  );
}