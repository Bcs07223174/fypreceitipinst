import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState, Component } from 'react';
import { User as FirebaseUser } from 'firebase/auth';

import { observeAuth, resolveAuthenticatedUserProfile, logout } from '../services/authService';
import { UserProfile } from '../styles/types';

const LAZY_RETRY_FLAG = 'lazy-route-retry-attempted';

function lazyWithRetry<T extends { default: React.ComponentType<any> }>(factory: () => Promise<T>) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isChunkError = message.includes('ChunkLoadError') || message.includes('Loading chunk');

      if (typeof window !== 'undefined' && isChunkError && !window.sessionStorage.getItem(LAZY_RETRY_FLAG)) {
        window.sessionStorage.setItem(LAZY_RETRY_FLAG, 'true');
        window.location.reload();
      }

      throw error;
    }
  });
}

const LoginPage = lazyWithRetry(() => import('../views/receptionist/LoginPage'));
const Dashboard = lazyWithRetry(() => import('../views/receptionist/Dashboard'));
const QRScannerPage = lazyWithRetry(() => import('../views/receptionist/QRScannerPage'));
const AppointmentList = lazyWithRetry(() => import('../views/receptionist/AppointmentList'));
const PatientBookingArchitecture = lazyWithRetry(() => import('../views/receptionist/PatientBookingArchitecture'));
const QueueManagement = lazyWithRetry(() => import('../views/receptionist/QueueManagement'));
const ProfilePage = lazyWithRetry(() => import('../views/receptionist/ProfilePage'));
const Layout = lazyWithRetry(() => import('./Layout'));
const DebugPage = lazyWithRetry(() => import('../views/DebugPage'));
const DoctorReceptionPage = lazyWithRetry(() => import('../views/doctor/DoctorReceptionPage'));

class RouteChunkBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    const message = error.message || String(error);
    const isChunkError = message.includes('ChunkLoadError') || message.includes('Loading chunk');

    if (typeof window !== 'undefined' && isChunkError && !window.sessionStorage.getItem(LAZY_RETRY_FLAG)) {
      window.sessionStorage.setItem(LAZY_RETRY_FLAG, 'true');
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
          <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-lg">
            <h1 className="text-xl font-bold text-slate-900">Route failed to load</h1>
            <p className="mt-3 text-sm text-slate-500">
              The page chunk could not be loaded. Reloading usually clears a stale development chunk.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-700"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

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
      <RouteChunkBoundary>
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
            <Route path="/patient-booking" element={<PatientBookingArchitecture profile={activeProfile} />} />
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
      </RouteChunkBoundary>
    </Router>
  );
}
