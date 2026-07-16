/**
 * @file Sidebar.jsx
 * @description Provides the navigation sidebar component containing menu views and active profile summary.
 */

import React from "react";
import { LayoutDashboard, DoorOpen, Map, AlertTriangle, Bot, Activity } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

const navItems = [
  { id: "dashboard", icon: LayoutDashboard, label: "Command Center" },
  { id: "gates", icon: DoorOpen, label: "Gate Control" },
  { id: "zones", icon: Map, label: "Zone Monitor" },
  { id: "incidents", icon: AlertTriangle, label: "Incidents" },
  { id: "ai", icon: Bot, label: "AI Agent" },
];

const avatarEmojis = {
  director: "👔",
  security: "👮",
  ops: "📊",
  google: "🌐",
};

/**
 * Sidebar Component.
 * Renders the primary navigation sidebar for the CrowdPulse command portal.
 * Handles switches between different views (Command Center, Gate Control, Zone Monitor, Incidents, AI Agent, Profile).
 *
 * @component
 * @param {Object} props - The component props.
 * @param {string} props.activeView - The currently active view identifier.
 * @param {Function} props.setActiveView - Callback function to update the active view.
 * @returns {React.JSX.Element} The rendered navigation sidebar.
 */
export default function Sidebar({ activeView, setActiveView }) {
  const { currentUser } = useAuth();

  return (
    <aside className="w-[72px] lg:w-[220px] h-screen bg-midnight-800/80 backdrop-blur-xl border-r border-white/[0.04] flex flex-col shrink-0">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-4 border-b border-white/[0.04]">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pulse-400 to-cyan-400 flex items-center justify-center shrink-0">
          <Activity size={18} className="text-midnight-900" strokeWidth={2.5} />
        </div>
        <div className="hidden lg:block">
          <h1 className="text-sm font-bold tracking-wide text-white">CrowdPulse</h1>
          <p className="text-[10px] text-pulse-400 font-mono tracking-widest uppercase">
            AI Command
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group
                ${
                  active
                    ? "bg-pulse-500/10 text-pulse-400 shadow-[inset_0_0_0_1px_rgba(56,242,176,0.15)]"
                    : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                }`}
            >
              <Icon
                size={18}
                className={active ? "text-pulse-400" : "text-gray-400 group-hover:text-gray-300"}
              />
              <span className="hidden lg:block truncate">{item.label}</span>
              {active && (
                <div className="hidden lg:block ml-auto w-1.5 h-1.5 rounded-full bg-pulse-400 animate-pulse-glow" />
              )}
            </button>
          );
        })}
      </nav>

      {/* User profile block */}
      {currentUser && (
        <button
          onClick={() => setActiveView("profile")}
          className={`p-3 border-t border-white/[0.04] text-left hover:bg-white/[0.02] transition-colors w-full flex items-center gap-2.5 group shrink-0
            ${activeView === "profile" ? "bg-pulse-500/5" : ""}`}
        >
          <div className="w-8 h-8 rounded-lg bg-midnight-600 border border-white/[0.06] flex items-center justify-center text-lg shrink-0">
            {avatarEmojis[currentUser.avatar] || "👤"}
          </div>
          <div className="hidden lg:block min-w-0 flex-1">
            <p className="text-xs font-bold text-white truncate leading-tight group-hover:text-pulse-400 transition-colors">
              {currentUser.displayName}
            </p>
            <p className="text-[9px] font-mono text-gray-400 truncate leading-none mt-0.5">
              {currentUser.role}
            </p>
          </div>
        </button>
      )}

      {/* Bottom info */}
      <div className="p-3 border-t border-white/[0.04] shrink-0">
        <div className="hidden lg:flex items-center gap-2 px-2">
          <div className="w-1.5 h-1.5 rounded-full bg-pulse-400 animate-pulse-glow" />
          <span className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">
            LIVE • 3s refresh
          </span>
        </div>
      </div>
    </aside>
  );
}
