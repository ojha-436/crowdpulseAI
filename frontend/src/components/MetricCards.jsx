import React from 'react';
import { Users, DoorOpen, AlertTriangle, ShieldCheck, TrendingUp, Gauge } from 'lucide-react';

export default function MetricCards({ state, analysis }) {
  if (!state) return null;

  const occupancyPct = ((state.currentOccupancy / state.capacity) * 100);
  const openGates = Object.values(state.gates).filter(g => g.status === 'open').length;
  const totalGates = Object.keys(state.gates).length;
  const activeIncidents = (state.incidents || []).filter(i => i.status === 'active').length;
  const avgQueue = Object.values(state.gates).reduce((sum, g) => sum + g.queueLength, 0) / totalGates;

  const riskColor = analysis?.overallRisk === 'high' ? 'text-alert-400' :
    analysis?.overallRisk === 'medium' ? 'text-warn-400' : 'text-pulse-400';

  const cards = [
    {
      label: 'Total Occupancy',
      value: state.currentOccupancy.toLocaleString(),
      sub: `/ ${state.capacity.toLocaleString()}`,
      pct: occupancyPct,
      icon: Users,
      color: occupancyPct > 85 ? 'text-alert-400' : occupancyPct > 60 ? 'text-warn-400' : 'text-pulse-400',
      barColor: occupancyPct > 85 ? 'bg-alert-400' : occupancyPct > 60 ? 'bg-warn-400' : 'bg-pulse-400',
    },
    {
      label: 'Active Gates',
      value: `${openGates}`,
      sub: `/ ${totalGates} total`,
      pct: (openGates / totalGates) * 100,
      icon: DoorOpen,
      color: 'text-cyan-400',
      barColor: 'bg-cyan-400',
    },
    {
      label: 'Active Incidents',
      value: activeIncidents.toString(),
      sub: activeIncidents === 0 ? 'All clear' : `${activeIncidents} requiring attention`,
      icon: AlertTriangle,
      color: activeIncidents > 3 ? 'text-alert-400' : activeIncidents > 0 ? 'text-warn-400' : 'text-pulse-400',
    },
    {
      label: 'Avg Gate Queue',
      value: avgQueue.toFixed(0),
      sub: 'people waiting',
      icon: Gauge,
      color: avgQueue > 40 ? 'text-warn-400' : 'text-cyan-400',
    },
    {
      label: 'Risk Level',
      value: analysis?.overallRisk?.toUpperCase() || 'NOMINAL',
      sub: `${analysis?.criticalZones?.length || 0} critical zones`,
      icon: ShieldCheck,
      color: riskColor,
    },
    {
      label: 'Flow Rate',
      value: Object.values(state.gates).reduce((s, g) => s + g.currentFlow, 0).toLocaleString(),
      sub: 'people/min total',
      icon: TrendingUp,
      color: 'text-pulse-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="glass-card p-4 animate-slide-up group hover:border-white/[0.1] transition-all duration-300"
            style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'backwards' }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">{card.label}</span>
              <Icon size={15} className={`${card.color} opacity-60`} />
            </div>
            <div className={`metric-value ${card.color}`}>{card.value}</div>
            <p className="text-[11px] text-gray-500 mt-1">{card.sub}</p>
            {card.pct !== undefined && (
              <div className="mt-3 h-1 bg-white/[0.04] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${card.barColor} transition-all duration-700`}
                  style={{ width: `${Math.min(100, card.pct)}%` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
