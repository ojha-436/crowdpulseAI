/**
 * @file AuthPage.jsx
 * @description Provides the user authentication interface for the CrowdPulse AI Command Center.
 * Handles user login and registration forms with validation.
 */

import React, { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { Activity, Mail, Lock, User, AlertCircle } from "lucide-react";

/**
 * AuthPage component.
 * Displays the login or registration forms, manages form input states, and triggers auth transitions.
 * 
 * @component
 * @returns {React.ReactElement} The AuthPage layout.
 */
export default function AuthPage() {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);

  // Form fields
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Handles form submission for registration or login.
   * 
   * @param {React.FormEvent} e - The form submission event.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        if (!email || !password) throw new Error("All fields are required.");
        await login(email, password);
      } else {
        if (!username || !email || !password || !confirmPassword) {
          throw new Error("All fields are required.");
        }
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }
        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters.");
        }
        await register(username, email, password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
            <h1 className="text-xl font-bold tracking-wide text-white leading-tight">
              CrowdPulse AI
            </h1>
            <p className="text-xs text-pulse-400 font-mono tracking-widest uppercase">
              Command Center Portal
            </p>
          </div>
        </div>

        {/* Auth Glassmorphism Card */}
        <div className="w-full bg-midnight-800/40 backdrop-blur-2xl border border-white/[0.08] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] p-6 sm:p-8 rounded-3xl relative overflow-hidden transition-all duration-300 hover:border-white/[0.12] hover:shadow-[0_25px_60px_-10px_rgba(56,242,176,0.05)]">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-pulse-400 via-cyan-400 to-pulse-400" />

          <h2 className="text-2xl font-bold text-white mb-2">
            {isLogin ? "Welcome Back Officer" : "Register Operator"}
          </h2>
          <p className="text-xs text-gray-400 mb-6">
            {isLogin
              ? "Provide credentials to access live stadium telemetry."
              : "Establish secure credentials for system clearance."}
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-alert-500/15 border border-alert-500/20 flex items-start gap-2.5 text-alert-400 text-xs animate-slide-up">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1.5">
                <label htmlFor="auth-username" className="text-[10px] font-mono text-gray-400 tracking-wider uppercase">
                  Username
                </label>
                <div className="relative">
                  <User
                    size={14}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    id="auth-username"
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
              <label htmlFor="auth-email" className="text-[10px] font-mono text-gray-400 tracking-wider uppercase">
                {isLogin ? "Email or Username" : "Email Address"}
              </label>
              <div className="relative">
                <Mail
                  size={14}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  id="auth-email"
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
              <label htmlFor="auth-password" className="text-[10px] font-mono text-gray-400 tracking-wider uppercase">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={14}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  id="auth-password"
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
                <label htmlFor="auth-confirmPassword" className="text-[10px] font-mono text-gray-400 tracking-wider uppercase">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock
                    size={14}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    id="auth-confirmPassword"
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
                "Sign In to Terminal"
              ) : (
                "Generate Operator ID"
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
              {isLogin
                ? "Don't have an operator ID? Create Account"
                : "Already authorized? Sign In"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
