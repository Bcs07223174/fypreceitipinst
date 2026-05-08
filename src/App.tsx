import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { observeAuth, getUserProfile } from './services/authService';
import { UserProfile } from './types';

// Pages
import LoginPage from './pages/receptionist/LoginPage';
import Dashboard from './pages/receptionist/Dashboard';
import QRScannerPage from './pages/receptionist/QRScannerPage';
import AppointmentList from './pages/receptionist/AppointmentList';
import QueueManagement from './pages/receptionist/QueueManagement';
import ProfilePage from './pages/receptionist/ProfilePage';
import Layout from './Layout';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = observeAuth(async (firebaseUser) => {
      try {
        setUser(firebaseUser);
        if (firebaseUser) {
          const userProfile = await getUserProfile(firebaseUser.uid);
          setProfile(userProfile);
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error("Auth observer error:", err);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-sky-500 border-t-transparent shadow-lg shadow-sky-100"></div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/" />} />
        
        <Route element={user ? <Layout profile={profile} /> : <Navigate to="/login" />}>
          <Route path="/" element={<Dashboard profile={profile} />} />
          <Route path="/scan" element={<QRScannerPage profile={profile} />} />
          <Route path="/appointments" element={<AppointmentList profile={profile} />} />
          <Route path="/queue" element={<QueueManagement profile={profile} />} />
          <Route path="/profile" element={<ProfilePage profile={profile} />} />
        </Route>
      </Routes>
    </Router>
  );
}
