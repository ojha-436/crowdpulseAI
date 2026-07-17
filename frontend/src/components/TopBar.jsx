/**
 * @file TopBar.jsx
 * @description Renders the top telemetry and control bar of the command center.
 * Displays match status controls, weather conditions, and includes the trigger for the AI Command Panel.
 */

import React, { useState } from "react";
import {
  Cloud,
  CloudRain,
  CloudLightning,
  Sun,
  Thermometer,
  Droplets,
  Bot,
  Radio,
} from "lucide-react";
import { updateMatchStatus } from "../hooks/useStadiumData.js";

/**
 * Mapping of weather conditions to Lucide icons.
 * @type {Object<string, React.ComponentType>}
 */
const weatherIcons = {
  clear: Sun,
  cloudy: Cloud,
  light_rain: CloudRain,
  heavy_rain: CloudRain,
  storm_warning: CloudLightning,
};

/**
 * Mapping of match status to color classes.
 * @type {Object<string, string>}
 */
const statusColors = {
  "pre-match": "bg-cyan-400/15 text-cyan-400 border-cyan-400/20",
  ongoing: "bg-pulse-400/15 text-pulse-400 border-pulse-400/20",
  break: "bg-warn-400/15 text-warn-400 border-warn-400/20",
  "post-match": "bg-gray-400/15 text-gray-400 border-gray-400/20",
  emergency: "bg-alert-400/15 text-alert-400 border-alert-400/20",
};

/**
 * Football-facing display labels for each match-status value. The backend keeps
 * sport-neutral status values; these labels present them in FIFA / football terms.
 * @type {Object<string, string>}
 */
const statusLabels = {
  "pre-match": "Pre-Match",
  ongoing: "Kick-Off / In Play",
  break: "Half-Time",
  "post-match": "Full-Time",
  emergency: "Emergency",
};

/**
 * TopBar component.
 * 
 * @component
 * @param {Object} props - Component properties.
 * @param {Object} props.state - Current stadium and match state object.
 * @param {Function} props.onOpenAI - Callback function when the AI Command Panel button is clicked.
 * @returns {React.ReactElement|null} The TopBar component layout.
 */
export default function TopBar({ state, onOpenAI }) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  if (!state) return null;

  const WeatherIcon = weatherIcons[state.weatherCondition] || Sun;

  /**
   * Handles updating the match status on the backend.
   *
   * @param {string} status - The new match status to be applied.
   * @returns {Promise<void>}
   */
  const handleStatusChange = async (status) => {
    await updateMatchStatus(status);
    setShowStatusMenu(false);
  };

  return (
    <header className="h-14 bg-midnight-800/50 backdrop-blur-xl border-b border-white/[0.04] flex items-center justify-between px-4 lg:px-6 shrink-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-pulse-400 animate-pulse-glow" aria-hidden="true" />
          <span className="text-xs font-mono text-gray-400 hidden sm:block">{state.name}</span>
        </div>

        {/* Match Status menu */}
        <div className="relative" onKeyDown={(e) => e.key === "Escape" && setShowStatusMenu(false)}>
          <button
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            // Menu trigger semantics for assistive tech.
            aria-haspopup="menu"
            aria-expanded={showStatusMenu}
            aria-label={`Match status: ${statusLabels[state.matchStatus] || state.matchStatus}. Change status`}
            className={`status-badge border cursor-pointer ${statusColors[state.matchStatus]}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" aria-hidden="true" />
            {(statusLabels[state.matchStatus] || state.matchStatus.replace("-", " ")).toUpperCase()}
          </button>
          {showStatusMenu && (
            <div
              role="menu"
              aria-label="Set match status"
              className="absolute top-full left-0 mt-2 z-50 bg-midnight-700 border border-white/10 rounded-xl p-1.5 shadow-2xl min-w-[160px] animate-fade-in"
            >
              {["pre-match", "ongoing", "break", "post-match", "emergency"].map((s) => (
                <button
                  key={s}
                  role="menuitem"
                  onClick={() => handleStatusChange(s)}
                  className="w-full text-left px-3 py-2 text-xs font-medium rounded-lg hover:bg-white/5 text-gray-300 hover:text-white transition-colors"
                >
                  {statusLabels[s] || s.replace("-", " ")}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Weather — icons are decorative; adjacent text conveys the values. */}
        <div className="hidden md:flex items-center gap-3 text-xs text-gray-400">
          <div className="flex items-center gap-1.5">
            <WeatherIcon size={14} aria-hidden="true" />
            <span className="capitalize">{state.weatherCondition?.replace("_", " ")}</span>
          </div>
          <div className="flex items-center gap-1">
            <Thermometer size={12} aria-hidden="true" />
            <span>{state.temperature?.toFixed(1)}°C</span>
          </div>
          <div className="flex items-center gap-1">
            <Droplets size={12} aria-hidden="true" />
            <span>{state.humidity?.toFixed(0)}%</span>
          </div>
        </div>

        {/* AI Button — label hidden on mobile, so name it via aria-label. */}
        <button
          onClick={onOpenAI}
          aria-label="Open AI Command panel"
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-pulse-500/20 to-cyan-500/20 border border-pulse-400/20 text-pulse-400 text-xs font-semibold hover:from-pulse-500/30 hover:to-cyan-500/30 transition-all"
        >
          <Bot size={14} aria-hidden="true" />
          <span className="hidden sm:block">AI Command</span>
        </button>
      </div>
    </header>
  );
}
