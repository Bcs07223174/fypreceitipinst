import { useState } from 'react';
import { loginWithGoogle, loginWithEmail, signUpWithEmail, sendResetPasswordEmail } from '../../services/authService';
import { motion } from 'motion/react';
import { LogIn, Activity, Mail, Lock, User, ArrowLeft } from 'lucide-react';

type AuthTab = 'login-google' | 'login-email' | 'signup-email' | 'forgot-password';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AuthTab>('login-google');

  // Email/Password form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

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

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await loginWithEmail(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await signUpWithEmail(email, password, fullName);
      setSuccess('Account created! Logging you in...');
      setTimeout(() => {
        setEmail('');
        setPassword('');
        setFullName('');
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Signup failed');
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await sendResetPasswordEmail(email);
      setSuccess('Password reset email sent! Check your inbox.');
      setEmail('');
      setTimeout(() => setActiveTab('login-email'), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 to-blue-50 p-4">
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

        {/* Tabs */}
        {activeTab !== 'forgot-password' && (
          <div className="mb-6 flex gap-2 rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => setActiveTab('login-google')}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                activeTab === 'login-google'
                  ? 'bg-white text-sky-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Google
            </button>
            <button
              onClick={() => setActiveTab('login-email')}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                activeTab === 'login-email'
                  ? 'bg-white text-sky-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Email Login
            </button>
            <button
              onClick={() => setActiveTab('signup-email')}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                activeTab === 'signup-email'
                  ? 'bg-white text-sky-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign Up
            </button>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-600 border border-red-100">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-xl bg-green-50 p-4 text-sm text-green-600 border border-green-100">
            {success}
          </div>
        )}

        {/* Google Login */}
        {activeTab === 'login-google' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
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

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-slate-500">or use email below</span>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('login-email')}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 px-6 py-3.5 font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-95"
            >
              <Mail size={20} />
              Login with Email
            </button>
          </motion.div>
        )}

        {/* Email Login */}
        {activeTab === 'login-email' && (
          <motion.form onSubmit={handleEmailLogin} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-sky-500 px-6 py-3.5 font-bold text-white transition-all hover:bg-sky-600 active:scale-95 disabled:opacity-50 shadow-lg shadow-sky-100"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              ) : (
                <LogIn size={20} />
              )}
              Login
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('forgot-password')}
              className="w-full text-center text-sm text-sky-600 hover:text-sky-700 font-medium"
            >
              Forgot your password?
            </button>
          </motion.form>
        )}

        {/* Email Sign Up */}
        {activeTab === 'signup-email' && (
          <motion.form onSubmit={handleEmailSignUp} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                required
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                required
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-sky-500 px-6 py-3.5 font-bold text-white transition-all hover:bg-sky-600 active:scale-95 disabled:opacity-50 shadow-lg shadow-sky-100"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              ) : (
                <User size={20} />
              )}
              Create Account
            </button>
          </motion.form>
        )}

        {/* Forgot Password */}
        {activeTab === 'forgot-password' && (
          <motion.form onSubmit={handleForgotPassword} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <button
              type="button"
              onClick={() => setActiveTab('login-email')}
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 font-medium mb-4"
            >
              <ArrowLeft size={16} />
              Back to Login
            </button>

            <p className="text-sm text-slate-600">
              Enter your email address and we'll send you a link to reset your password.
            </p>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-sky-500 px-6 py-3.5 font-bold text-white transition-all hover:bg-sky-600 active:scale-95 disabled:opacity-50 shadow-lg shadow-sky-100"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              ) : (
                <Mail size={20} />
              )}
              Send Reset Email
            </button>
          </motion.form>
        )}

        <p className="mt-8 text-center text-xs text-slate-400">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </motion.div>
    </div>
  );
}
