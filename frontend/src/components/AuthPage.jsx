import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Activity, Mail, Lock, User, Shield, AlertCircle } from 'lucide-react';

export default function AuthPage() {
  const { login, register, loginWithGoogle } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  
  // Form fields
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        if (!email || !password) throw new Error('All fields are required.');
        await login(email, password);
      } else {
        if (!username || !email || !password || !confirmPassword) {
          throw new Error('All fields are required.');
        }
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match.');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }
        await register(username, email, password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(err.message || 'Google Sign-In failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail) => {
    setEmail(demoEmail);
    setPassword('password123');
    setIsLogin(true);
    setError(null);
  };

  return (
    <div className="min-screen h-screen w-screen flex items-center justify-center bg-midnight-900 overflow-y-auto px-4 relative">
      {/* Decorative Radial Background Lights */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-pulse-500/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none" />
      
      <div className="w-full max-w-[440px] my-8 relative z-10 flex flex-col items-center">
        {/* App Branding */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-pulse-400 to-cyan-400 flex items-center justify-center shadow-lg shadow-pulse-400/20">
            <Activity size={22} className="text-midnight-900" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wide text-white leading-tight">CrowdPulse AI</h1>
            <p className="text-xs text-pulse-400 font-mono tracking-widest uppercase">Command Center Portal</p>
          </div>
        </div>

        {/* Auth Glassmorphism Card */}
        <div className="w-full bg-midnight-800/40 backdrop-blur-2xl border border-white/[0.08] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] p-6 sm:p-8 rounded-3xl relative overflow-hidden transition-all duration-300 hover:border-white/[0.12] hover:shadow-[0_25px_60px_-10px_rgba(56,242,176,0.05)]">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-pulse-400 via-cyan-400 to-pulse-400" />
          
          <h2 className="text-2xl font-bold text-white mb-2">
            {isLogin ? 'Welcome Back Officer' : 'Register Operator'}
          </h2>
          <p className="text-xs text-gray-400 mb-6">
            {isLogin ? 'Provide credentials to access live stadium telemetry.' : 'Establish secure credentials for system clearance.'}
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-alert-500/15 border border-alert-500/20 flex items-start gap-2.5 text-alert-400 text-xs animate-slide-up">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Social Auth */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-white text-midnight-900 font-semibold text-sm flex items-center justify-center gap-2.5 hover:bg-gray-100 active:scale-[0.98] transition-all duration-200 shadow-md disabled:opacity-50 disabled:pointer-events-none"
          >
            {/* Google Vector Icon */}
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5.04c1.62 0 3.08.56 4.22 1.64l3.15-3.15C17.45 1.74 14.93 1 12 1 7.35 1 3.39 3.65 1.45 7.5l3.87 3C6.27 7.74 8.89 5.04 12 5.04z"
              />
              <path
                fill="#4285F4"
                d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.76 2.91c2.2-2.03 3.67-5.01 3.67-8.64z"
              />
              <path
                fill="#FBBC05"
                d="M5.32 14.5c-.24-.74-.38-1.53-.38-2.5s.14-1.76.38-2.5L1.45 6.5C.53 8.32 0 10.4 0 12.5s.53 4.18 1.45 6l3.87-3z"
              />
              <path
                fill="#34A853"
                d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.76-2.91c-1.1.74-2.51 1.18-4.2 1.18-3.11 0-5.73-2.7-6.68-5.46l-3.87 3C3.39 20.35 7.35 23 12 23z"
              />
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">Or Credentials</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-gray-400 tracking-wider uppercase">Username</label>
                <div className="relative">
                  <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="abhiraj"
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-2 bg-midnight-700/40 border border-white/[0.08] focus:border-pulse-400/50 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none transition-colors"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-gray-400 tracking-wider uppercase">
                {isLogin ? 'Email or Username' : 'Email Address'}
              </label>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type={isLogin ? "text" : "email"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isLogin ? "iamabhiraj8825@gmail.com" : "officer@stadium.gov"}
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-2 bg-midnight-700/40 border border-white/[0.08] focus:border-pulse-400/50 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-gray-400 tracking-wider uppercase">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-2 bg-midnight-700/40 border border-white/[0.08] focus:border-pulse-400/50 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {!isLogin && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-gray-400 tracking-wider uppercase">Confirm Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-2 bg-midnight-700/40 border border-white/[0.08] focus:border-pulse-400/50 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none transition-colors"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 rounded-xl bg-gradient-to-r from-pulse-500 to-cyan-500 text-midnight-900 font-bold text-sm hover:from-pulse-400 hover:to-cyan-400 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-pulse-500/10 disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-midnight-900 border-t-transparent rounded-full animate-spin" />
              ) : isLogin ? (
                'Sign In to Terminal'
              ) : (
                'Generate Operator ID'
              )}
            </button>
          </form>

          {/* Form Switcher */}
          <div className="mt-5 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
              }}
              className="text-xs text-gray-400 hover:text-pulse-400 transition-colors font-medium"
            >
              {isLogin ? "Don't have an operator ID? Create Account" : 'Already authorized? Sign In'}
            </button>
          </div>
        </div>

        {/* Demo Fast-Track Logins */}
        {isLogin && (
          <div className="w-full mt-6 bg-midnight-800/20 backdrop-blur-md border border-white/[0.04] p-4 rounded-2xl">
            <h3 className="text-[10px] font-mono text-gray-500 tracking-widest uppercase mb-3 flex items-center gap-1.5">
              <Shield size={11} className="text-pulse-400" />
              Bengaluru Hackathon Fast-Track Access
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleQuickLogin('iamabhiraj8825@gmail.com')}
                className="p-2.5 rounded-xl bg-midnight-700/25 border border-white/[0.04] hover:border-cyan-400/30 text-left hover:bg-cyan-950/10 transition-all group"
              >
                <p className="text-xs font-bold text-white group-hover:text-cyan-400 transition-colors">Abhiraj Singh</p>
                <p className="text-[9px] font-mono text-gray-500 group-hover:text-gray-400">Director Account</p>
              </button>
              <button
                onClick={() => handleQuickLogin('security@crowdpulse.ai')}
                className="p-2.5 rounded-xl bg-midnight-700/25 border border-white/[0.04] hover:border-pulse-400/30 text-left hover:bg-pulse-950/10 transition-all group"
              >
                <p className="text-xs font-bold text-white group-hover:text-pulse-400 transition-colors">Vikram Malhotra</p>
                <p className="text-[9px] font-mono text-gray-500 group-hover:text-gray-400">Security Chief</p>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
