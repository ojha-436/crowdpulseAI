/**
 * @file ProfileView.jsx
 * @description Provides the User Profile settings and Clearance audit page layout.
 */

import React, { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { User, Shield, Key, CheckCircle, LogOut, Terminal, Award } from "lucide-react";

const avatarEmojis = {
  director: "👔",
  security: "👮",
  ops: "📊",
  google: "🌐",
};

const roleClearance = {
  "Stadium Director": "Level-5 (Super-Admin)",
  "Security Chief": "Level-4 (Incident-Cmd)",
  "Operations Lead": "Level-3 (Tactical-Ops)",
  "Operations Analyst": "Level-2 (Standard-Write)",
};

/**
 * ProfileView Component.
 * Displays current user profile configuration settings, clearance level audit, and session statistics.
 * Allows user operators to update their display name, designation role, avatar, and password.
 *
 * @component
 * @returns {React.JSX.Element|null} The rendered profile configuration view.
 */
export default function ProfileView() {
  const { currentUser, updateProfile, logout } = useAuth();
  const [displayName, setDisplayName] = useState(currentUser?.displayName || "");
  const [role, setRole] = useState(currentUser?.role || "Operations Analyst");
  const [avatar, setAvatar] = useState(currentUser?.avatar || "ops");
  const [password, setPassword] = useState("");

  // UI states
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /**
   * Handles submission of the profile updates form.
   * Compiles the modifications, triggers updateProfile on the AuthContext, and manages visual feedback.
   *
   * @param {React.FormEvent} e - The form submission event.
   * @returns {Promise<void>}
   */
  const handleUpdate = async (e) => {
    e.preventDefault();
    setSuccess(false);
    setError("");
    setLoading(true);

    try {
      const updates = {
        displayName,
        role,
        avatar,
        clearance: roleClearance[role] || "Level-2 (Standard-Write)",
      };
      if (password) {
        updates.password = password;
      }
      await updateProfile(updates);
      setSuccess(true);
      setPassword("");
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to update profile settings.");
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-slide-up">
      {/* Top Banner Card */}
      <div className="bg-gradient-to-r from-midnight-800/80 to-midnight-700/60 border border-white/[0.06] rounded-3xl p-6 relative overflow-hidden flex flex-col md:flex-row items-center gap-6">
        <div className="absolute top-0 right-0 w-[200px] h-[200px] rounded-full bg-pulse-500/5 blur-[50px] pointer-events-none" />

        {/* Large Avatar */}
        <div className="w-20 h-20 rounded-2xl bg-midnight-600 border-2 border-pulse-400/30 flex items-center justify-center text-4xl shrink-0 shadow-lg shadow-pulse-400/5">
          {avatarEmojis[avatar] || "👤"}
        </div>

        {/* User Quick Info */}
        <div className="text-center md:text-left flex-1 space-y-1">
          <h2 className="text-2xl font-bold text-white tracking-wide">{currentUser.displayName}</h2>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-pulse-500/10 text-pulse-400 border border-pulse-500/20 tracking-wider font-mono uppercase">
              {currentUser.role}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 tracking-wider font-mono uppercase">
              {currentUser.clearance}
            </span>
          </div>
          <p className="text-xs text-gray-400 font-mono">
            Operator Registered: {currentUser.joinedDate}
          </p>
        </div>

        {/* Logout Button */}
        <button
          onClick={logout}
          className="px-4 py-2 rounded-xl bg-alert-500/10 hover:bg-alert-500/20 border border-alert-500/20 text-alert-400 text-xs font-bold transition-all flex items-center gap-2"
        >
          <LogOut size={13} />
          Terminate Session
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Stats / Clearance details */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-midnight-800/80 backdrop-blur-xl border border-white/[0.04] p-5 rounded-2xl">
            <h3 className="text-xs font-mono font-semibold tracking-wider text-pulse-400 uppercase mb-4 flex items-center gap-2">
              <Shield size={14} />
              Clearence Audit
            </h3>

            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] text-gray-400 font-mono uppercase">
                  Terminal Access Level
                </p>
                <p className="text-sm font-bold text-white">{currentUser.clearance}</p>
              </div>
              <div className="h-px bg-white/[0.04]" />
              <div className="space-y-1">
                <p className="text-[10px] text-gray-400 font-mono uppercase">System Logins</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Terminal size={12} className="text-pulse-400" />
                  <span className="text-sm font-mono font-bold text-white">Active</span>
                </div>
              </div>
              <div className="h-px bg-white/[0.04]" />
              <div className="space-y-1">
                <p className="text-[10px] text-gray-400 font-mono uppercase">System Activity</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Award size={12} className="text-cyan-400" />
                  <span className="text-sm font-mono font-bold text-white">
                    {currentUser.commandsCount} ActionsLogged
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Settings form */}
        <div className="md:col-span-2">
          <div className="bg-midnight-800/80 backdrop-blur-xl border border-white/[0.04] p-6 rounded-2xl">
            <h3 className="text-base font-bold text-white mb-6 flex items-center gap-2.5">
              <User size={18} className="text-pulse-400" />
              Configure Terminal Profile
            </h3>

            {success && (
              <div className="mb-6 p-3 rounded-xl bg-pulse-500/10 border border-pulse-500/20 text-pulse-400 text-xs flex items-center gap-2 animate-slide-up">
                <CheckCircle size={14} className="shrink-0" />
                <span>Operator settings successfully committed to local registry.</span>
              </div>
            )}

            {error && (
              <div className="mb-6 p-3 rounded-xl bg-alert-500/10 border border-alert-500/20 text-alert-400 text-xs flex items-center gap-2 animate-slide-up">
                <Shield size={14} className="shrink-0 animate-pulse" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleUpdate} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="profile-displayName" className="text-[10px] font-mono text-gray-400 tracking-wider uppercase">
                    Display Name
                  </label>
                  <input
                    id="profile-displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    disabled={loading}
                    className="w-full px-4 py-2 bg-midnight-700/40 border border-white/[0.08] focus:border-pulse-400/50 rounded-xl text-sm text-white focus:outline-none transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="profile-role" className="text-[10px] font-mono text-gray-400 tracking-wider uppercase">
                    Designation / Role
                  </label>
                  <select
                    id="profile-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    disabled={loading}
                    className="w-full px-4 py-2 bg-midnight-700/40 border border-white/[0.08] focus:border-pulse-400/50 rounded-xl text-sm text-white focus:outline-none transition-colors"
                  >
                    <option value="Stadium Director" className="bg-midnight-800">
                      Stadium Director
                    </option>
                    <option value="Security Chief" className="bg-midnight-800">
                      Security Chief
                    </option>
                    <option value="Operations Lead" className="bg-midnight-800">
                      Operations Lead
                    </option>
                    <option value="Operations Analyst" className="bg-midnight-800">
                      Operations Analyst
                    </option>
                  </select>
                </div>
              </div>

              {/* Avatar Picker */}
              <div className="space-y-2">
                <label className="text-[10px] font-mono text-gray-400 tracking-wider uppercase">
                  Avatar Designation
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {Object.entries(avatarEmojis).map(([key, emoji]) => {
                    const active = avatar === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setAvatar(key)}
                        disabled={loading}
                        className={`py-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                          active
                            ? "bg-pulse-500/10 border-pulse-400 text-white shadow-md shadow-pulse-400/5"
                            : "bg-midnight-700/20 border-white/[0.06] hover:bg-white/[0.04] text-gray-400"
                        }`}
                      >
                        <span className="text-2xl">{emoji}</span>
                        <span className="text-[9px] font-mono tracking-wider uppercase">{key}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="h-px bg-white/[0.04]" />

              <div className="space-y-1.5">
                <label htmlFor="profile-password" className="text-[10px] font-mono text-gray-400 tracking-wider uppercase flex items-center gap-1.5">
                  <Key size={11} className="text-gray-400" />
                  Override Password (Leave blank to keep current)
                </label>
                <input
                  id="profile-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  className="w-full px-4 py-2 bg-midnight-700/40 border border-white/[0.08] focus:border-pulse-400/50 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-pulse-500 to-cyan-500 text-midnight-900 font-bold text-xs hover:from-pulse-400 hover:to-cyan-400 transition-all shadow-md shadow-pulse-500/5 flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? "Committing Changes..." : "Commit Profile Updates"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
