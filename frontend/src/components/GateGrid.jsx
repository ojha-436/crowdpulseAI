import React, { useState } from 'react';
import { DoorOpen, Users, Clock, ChevronDown, Zap } from 'lucide-react';
import { updateGateStatus } from '../hooks/useStadiumData.js';

const statusStyles = {
  open: { bg: 'bg-pulse-400/10', text: 'text-pulse-400', dot: 'bg-pulse-400' },
  closed: { bg: 'bg-alert-400/10', text: 'text-alert-400', dot: 'bg-alert-400' },
  restricted: { bg: 'bg-warn-400/10', text: 'text-warn-400', dot: 'bg-warn-400' },
  exit_only: { bg: 'bg-cyan-400/10', text: 'text-cyan-400', dot: 'bg-cyan-400' },
};

export default function GateGrid({ gates, expanded }) {
  const [selectedGate, setSelectedGate] = useState(null);
  if (!gates) return null;

  const gateEntries = Object.entries(gates);

  const handleStatusChange = async (gateId, newStatus) => {
    await updateGateStatus(gateId, newStatus);
    setSelectedGate(null);
  };

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <DoorOpen size={16} className="text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">Gate Control Panel</h3>
        </div>
        <span className="text-[10px] font-mono text-gray-500">
          {gateEntries.filter(([_, g]) => g.status === 'open').length}/{gateEntries.length} ACTIVE
        </span>
      </div>

      <div className={`grid gap-2 ${expanded ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-2 lg:grid-cols-3'}`}>
        {gateEntries.map(([id, gate]) => {
          const style = statusStyles[gate.status] || statusStyles.open;
          const loadPct = (gate.currentLoad / gate.maxCapacity) * 100;
          return (
            <div
              key={id}
              className={`relative p-3 rounded-xl border border-white/[0.04] bg-midnight-900/50 hover:border-white/[0.08] transition-all group cursor-pointer ${
                selectedGate === id ? 'ring-1 ring-pulse-400/30' : ''
              }`}
              onClick={() => setSelectedGate(selectedGate === id ? null : id)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white">{id}</span>
                <span className={`status-badge text-[10px] ${style.bg} ${style.text}`}>
                  <span className={`w-1 h-1 rounded-full ${style.dot}`} />
                  {gate.status}
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-500 flex items-center gap-1"><Zap size={10} />Flow</span>
                  <span className="font-mono text-gray-300">{gate.currentFlow}/min</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-500 flex items-center gap-1"><Users size={10} />Queue</span>
                  <span className={`font-mono ${gate.queueLength > 50 ? 'text-warn-400' : 'text-gray-300'}`}>
                    {gate.queueLength}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-500 flex items-center gap-1"><Clock size={10} />Wait</span>
                  <span className="font-mono text-gray-300">{gate.avgProcessingTime.toFixed(0)}s</span>
                </div>
              </div>

              {/* Load bar */}
              <div className="mt-2 h-1 bg-white/[0.04] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    loadPct > 80 ? 'bg-alert-400' : loadPct > 50 ? 'bg-warn-400' : 'bg-pulse-400'
                  }`}
                  style={{ width: `${loadPct}%` }}
                />
              </div>

              {/* Gate control dropdown */}
              {selectedGate === id && (
                <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-midnight-700 border border-white/10 rounded-xl p-1.5 shadow-2xl animate-fade-in">
                  {['open', 'closed', 'restricted', 'exit_only'].map((s) => (
                    <button
                      key={s}
                      onClick={(e) => { e.stopPropagation(); handleStatusChange(id, s); }}
                      className={`w-full text-left px-3 py-1.5 text-[11px] font-medium rounded-lg hover:bg-white/5 transition-colors capitalize ${
                        gate.status === s ? 'text-pulse-400' : 'text-gray-400'
                      }`}
                    >
                      Set {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
