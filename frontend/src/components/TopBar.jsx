import React, { useState } from 'react';
import { Cloud, CloudRain, CloudLightning, Sun, Thermometer, Droplets, Bot, Radio } from 'lucide-react';
import { updateMatchStatus } from '../hooks/useStadiumData.js';

const weatherIcons = {
  clear: Sun,
  cloudy: Cloud,
  light_rain: CloudRain,
  heavy_rain: CloudRain,
  storm_warning: CloudLightning,
};

const statusColors = {
  'pre-match': 'bg-cyan-400/15 text-cyan-400 border-cyan-400/20',
  ongoing: 'bg-pulse-400/15 text-pulse-400 border-pulse-400/20',
  break: 'bg-warn-400/15 text-warn-400 border-warn-400/20',
  'post-match': 'bg-gray-400/15 text-gray-400 border-gray-400/20',
  emergency: 'bg-alert-400/15 text-alert-400 border-alert-400/20',
};

export default function TopBar({ state, analysis, onOpenAI }) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  if (!state) return null;

  const WeatherIcon = weatherIcons[state.weatherCondition] || Sun;

  const handleStatusChange = async (status) => {
    await updateMatchStatus(status);
    setShowStatusMenu(false);
  };

  return (
    <header className="h-14 bg-midnight-800/50 backdrop-blur-xl border-b border-white/[0.04] flex items-center justify-between px-4 lg:px-6 shrink-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-pulse-400 animate-pulse-glow" />
          <span className="text-xs font-mono text-gray-400 hidden sm:block">
            {state.name}
          </span>
        </div>

        {/* Match Status */}
        <div className="relative">
          <button
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            className={`status-badge border cursor-pointer ${statusColors[state.matchStatus]}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            {state.matchStatus.replace('-', ' ').toUpperCase()}
          </button>
          {showStatusMenu && (
            <div className="absolute top-full left-0 mt-2 z-50 bg-midnight-700 border border-white/10 rounded-xl p-1.5 shadow-2xl min-w-[160px] animate-fade-in">
              {['pre-match', 'ongoing', 'break', 'post-match', 'emergency'].map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  className="w-full text-left px-3 py-2 text-xs font-medium rounded-lg hover:bg-white/5 text-gray-300 hover:text-white transition-colors capitalize"
                >
                  {s.replace('-', ' ')}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Weather */}
        <div className="hidden md:flex items-center gap-3 text-xs text-gray-400">
          <div className="flex items-center gap-1.5">
            <WeatherIcon size={14} />
            <span className="capitalize">{state.weatherCondition?.replace('_', ' ')}</span>
          </div>
          <div className="flex items-center gap-1">
            <Thermometer size={12} />
            <span>{state.temperature?.toFixed(1)}°C</span>
          </div>
          <div className="flex items-center gap-1">
            <Droplets size={12} />
            <span>{state.humidity?.toFixed(0)}%</span>
          </div>
        </div>

        {/* AI Button */}
        <button
          onClick={onOpenAI}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-pulse-500/20 to-cyan-500/20 border border-pulse-400/20 text-pulse-400 text-xs font-semibold hover:from-pulse-500/30 hover:to-cyan-500/30 transition-all"
        >
          <Bot size={14} />
          <span className="hidden sm:block">AI Command</span>
        </button>
      </div>
    </header>
  );
}
