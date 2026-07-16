/**
 * @file ZoneMap.jsx
 * @description Renders a safety density map of the stadium zones with radial status rings.
 */

import React from "react";
import { Map, AlertTriangle, ThermometerSun } from "lucide-react";

const riskColors = {
  low: {
    bg: "bg-pulse-400/15",
    border: "border-pulse-400/20",
    text: "text-pulse-400",
    fill: "bg-pulse-400",
  },
  medium: {
    bg: "bg-cyan-400/15",
    border: "border-cyan-400/20",
    text: "text-cyan-400",
    fill: "bg-cyan-400",
  },
  high: {
    bg: "bg-warn-400/15",
    border: "border-warn-400/20",
    text: "text-warn-400",
    fill: "bg-warn-400",
  },
  critical: {
    bg: "bg-alert-400/15",
    border: "border-alert-400/20",
    text: "text-alert-400",
    fill: "bg-alert-400",
  },
};

/**
 * ZoneMap Component.
 * Displays density and telemetry (temperature, risk level, occupancy, exits) for each stadium zone.
 * Uses a grid of cards with radial progress rings indicating percentage density.
 *
 * @component
 * @param {Object} props - The component props.
 * @param {Object} props.zones - Dictionary of zone details.
 * @param {boolean} props.expanded - If true, displays the zone map in a wider multi-column layout.
 * @returns {React.JSX.Element|null} The rendered zone density map component.
 */
export default function ZoneMap({ zones, expanded }) {
  if (!zones) return null;
  const zoneEntries = Object.entries(zones);

  return (
    <div className="glass-card p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Map size={16} className="text-warn-400" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-white">Zone Density Map</h3>
        </div>
        <div className="flex items-center gap-2">
          {["low", "medium", "high", "critical"].map((r) => (
            <div key={r} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${riskColors[r].fill}`} aria-hidden="true" />
              <span className="text-[9px] text-gray-400 uppercase">{r}</span>
            </div>
          ))}
        </div>
      </div>

      <div
        className={`grid gap-2 ${expanded ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4" : "grid-cols-2"}`}
      >
        {zoneEntries.map(([name, zone]) => {
          const rc = riskColors[zone.riskLevel] || riskColors.low;
          const densityPct = (zone.density * 100).toFixed(0);
          return (
            <div
              key={name}
              className={`relative p-3 rounded-xl border ${rc.border} ${rc.bg} transition-all hover:scale-[1.02] duration-200`}
            >
              {zone.riskLevel === "critical" && (
                <div className="absolute -top-1 -right-1">
                  <AlertTriangle size={14} className="text-alert-400 animate-pulse" aria-hidden="true" />
                </div>
              )}
              <h4 className="text-xs font-bold text-white truncate mb-2">{name}</h4>

              {/* Density Ring — exposed as a progressbar for the zone's density %. */}
              <div className="flex items-center gap-3 mb-2">
                <div
                  role="progressbar"
                  aria-label={`${name} density ${densityPct}%, ${zone.riskLevel} risk`}
                  aria-valuenow={Number(densityPct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="relative w-12 h-12"
                >
                  <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48" aria-hidden="true">
                    <circle
                      cx="24"
                      cy="24"
                      r="20"
                      fill="none"
                      stroke="rgba(255,255,255,0.05)"
                      strokeWidth="4"
                    />
                    <circle
                      cx="24"
                      cy="24"
                      r="20"
                      fill="none"
                      stroke={
                        zone.riskLevel === "critical"
                          ? "#ff4757"
                          : zone.riskLevel === "high"
                            ? "#ff8c00"
                            : zone.riskLevel === "medium"
                              ? "#22d3ee"
                              : "#38f2b0"
                      }
                      strokeWidth="4"
                      strokeDasharray={`${zone.density * 125.6} 125.6`}
                      strokeLinecap="round"
                      className="transition-all duration-700"
                    />
                  </svg>
                  <span
                    className={`absolute inset-0 flex items-center justify-center text-xs font-bold font-mono ${rc.text}`}
                  >
                    {densityPct}%
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-gray-400">
                    {zone.currentOccupancy.toLocaleString()}
                    <span className="text-gray-400"> / {zone.capacity.toLocaleString()}</span>
                  </div>
                  <div className={`text-[10px] font-mono uppercase font-bold mt-0.5 ${rc.text}`}>
                    {zone.riskLevel} risk
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 text-[10px] text-gray-400">
                <ThermometerSun size={10} aria-hidden="true" />
                <span>{zone.temperature?.toFixed(1)}°C</span>
                <span className="mx-1">•</span>
                <span>{zone.exitRoutes} exits</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
