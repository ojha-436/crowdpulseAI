/**
 * @file AlertBanner.jsx
 * @description Renders critical active alert banner notifications at the top of the dashboard interface.
 */

import React, { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

/**
 * AlertBanner Component.
 * Displays critical active alert notifications at the top of the interface.
 * Allows dismissing alerts on a per-session basis.
 *
 * @component
 * @param {Object} props - The component props.
 * @param {Array<Object>} props.alerts - Array of alert objects to display.
 * @param {string|number} props.alerts[].id - Unique identifier of the alert.
 * @param {string} props.alerts[].severity - Severity level of the alert (e.g., 'critical', 'warning').
 * @param {string} props.alerts[].message - Notification message content.
 * @returns {React.JSX.Element|null} The rendered alert banner, or null if no critical alerts.
 */
export default function AlertBanner({ alerts }) {
  const [dismissed, setDismissed] = useState(new Set());

  if (!alerts) return null;
  const active = alerts.filter((a) => a.severity === "critical" && !dismissed.has(a.id));
  if (active.length === 0) return null;

  const alert = active[0];

  return (
    <div className="mx-4 mt-3 px-4 py-3 rounded-xl bg-alert-400/10 border border-alert-400/20 flex items-center gap-3 animate-fade-in">
      <AlertTriangle size={16} className="text-alert-400 shrink-0" />
      <p className="text-xs text-alert-300 flex-1 font-medium">{alert.message}</p>
      <button
        onClick={() => setDismissed((s) => new Set([...s, alert.id]))}
        aria-label="Dismiss alert"
        className="p-1 rounded hover:bg-white/5 text-alert-400/60 hover:text-alert-400 transition-colors shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
}
