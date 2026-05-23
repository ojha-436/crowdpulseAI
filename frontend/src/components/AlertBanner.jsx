import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function AlertBanner({ alerts }) {
  const [dismissed, setDismissed] = useState(new Set());

  if (!alerts) return null;
  const active = alerts.filter(
    (a) => a.priority === 'critical' && !dismissed.has(a.id)
  );
  if (active.length === 0) return null;

  const alert = active[0];

  return (
    <div className="mx-4 mt-3 px-4 py-3 rounded-xl bg-alert-400/10 border border-alert-400/20 flex items-center gap-3 animate-fade-in">
      <AlertTriangle size={16} className="text-alert-400 shrink-0" />
      <p className="text-xs text-alert-300 flex-1 font-medium">{alert.message}</p>
      <button
        onClick={() => setDismissed((s) => new Set([...s, alert.id]))}
        className="p-1 rounded hover:bg-white/5 text-alert-400/60 hover:text-alert-400 transition-colors shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
}
