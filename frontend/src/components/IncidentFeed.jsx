import React from 'react';
import { AlertTriangle, ShieldAlert, HeartPulse, CloudLightning, Wrench, Users, CheckCircle2 } from 'lucide-react';
import { resolveIncident } from '../hooks/useStadiumData.js';

const typeConfig = {
  medical: { icon: HeartPulse, color: 'text-alert-400', bg: 'bg-alert-400/10' },
  security: { icon: ShieldAlert, color: 'text-warn-400', bg: 'bg-warn-400/10' },
  congestion: { icon: Users, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
  equipment_failure: { icon: Wrench, color: 'text-gray-400', bg: 'bg-gray-400/10' },
  weather_alert: { icon: CloudLightning, color: 'text-purple-400', bg: 'bg-purple-400/10' },
};

const sevBadge = {
  low: 'bg-gray-500/15 text-gray-400',
  medium: 'bg-cyan-400/15 text-cyan-400',
  high: 'bg-warn-400/15 text-warn-400',
  critical: 'bg-alert-400/15 text-alert-400',
};

export default function IncidentFeed({ incidents, expanded }) {
  if (!incidents) return null;
  const list = expanded ? incidents : incidents.slice(0, 8);

  const handleResolve = async (id) => {
    await resolveIncident(id);
  };

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-alert-400" />
          <h3 className="text-sm font-semibold text-white">Incident Feed</h3>
        </div>
        <span className="text-[10px] font-mono text-gray-500">
          {incidents.filter(i => i.status === 'active').length} ACTIVE
        </span>
      </div>

      <div className={`space-y-2 ${expanded ? 'max-h-[70vh]' : 'max-h-[320px]'} overflow-y-auto pr-1`}>
        {list.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            <ShieldAlert size={24} className="mx-auto mb-2 opacity-30" />
            No incidents reported
          </div>
        )}
        {list.map((incident) => {
          const config = typeConfig[incident.type] || typeConfig.security;
          const Icon = config.icon;
          const isActive = incident.status === 'active';
          const timeAgo = Math.floor((Date.now() - incident.timestamp) / 1000);
          const timeStr = timeAgo < 60 ? `${timeAgo}s ago` : `${Math.floor(timeAgo / 60)}m ago`;

          return (
            <div
              key={incident.id}
              className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                isActive
                  ? 'bg-midnight-900/50 border-white/[0.04] hover:border-white/[0.08]'
                  : 'bg-midnight-900/20 border-white/[0.02] opacity-50'
              }`}
            >
              <div className={`p-2 rounded-lg ${config.bg} shrink-0`}>
                <Icon size={14} className={config.color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`status-badge text-[10px] ${sevBadge[incident.severity]}`}>
                    {incident.severity}
                  </span>
                  <span className="text-[10px] text-gray-500 capitalize">{incident.type.replace('_', ' ')}</span>
                  <span className="text-[10px] text-gray-600 ml-auto shrink-0">{timeStr}</span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">{incident.description}</p>
                <p className="text-[10px] text-gray-500 mt-1">Zone: {incident.zone}</p>
              </div>
              {isActive && (
                <button
                  onClick={() => handleResolve(incident.id)}
                  className="shrink-0 p-1.5 rounded-lg hover:bg-pulse-400/10 text-gray-500 hover:text-pulse-400 transition-colors"
                  title="Resolve"
                >
                  <CheckCircle2 size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
