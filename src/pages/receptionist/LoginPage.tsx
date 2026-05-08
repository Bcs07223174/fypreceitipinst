import { useState } from 'react';
import { loginWithGoogle } from '../../services/authService';
import { motion } from 'motion/react';
import { LogIn, Activity } from 'lucide-react';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Login failed');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl shadow-slate-200"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-lg shadow-sky-100">
            <Activity size={32} />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Medicare Clinic</h1>
          <p className="text-slate-500 font-medium">Receptionist Portal</p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-600 border border-red-100">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-sky-500 px-6 py-3.5 font-bold text-white transition-all hover:bg-sky-600 active:scale-95 disabled:opacity-50 shadow-lg shadow-sky-100"
        >
          {loading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
          ) : (
            <LogIn size={20} />
          )}
          Continue with Google
        </button>

        <p className="mt-8 text-center text-xs text-slate-400">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </motion.div>
    </div>
  );
}
