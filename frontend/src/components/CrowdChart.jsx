import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { TrendingUp } from "lucide-react";

export default function CrowdChart({ history, capacity }) {
  if (!history || history.length === 0) return null;

  const data = history.map((h, i) => ({
    tick: i,
    occupancy: h.occupancy,
    pct: ((h.occupancy / capacity) * 100).toFixed(1),
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-midnight-700/95 backdrop-blur-xl border border-white/10 rounded-xl px-3 py-2 shadow-2xl">
          <p className="text-xs font-bold text-white">
            {parseInt(d.occupancy).toLocaleString()} people
          </p>
          <p className="text-[10px] text-gray-400">{d.pct}% capacity</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass-card p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-pulse-400" />
          <h3 className="text-sm font-semibold text-white">Live Occupancy Trend</h3>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-gray-400">
          <span>Capacity: {capacity.toLocaleString()}</span>
          <span className="text-pulse-400">Current: {data[data.length - 1]?.pct}%</span>
        </div>
      </div>

      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="crowdGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38f2b0" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#38f2b0" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
            <XAxis dataKey="tick" hide />
            <YAxis
              domain={[0, capacity]}
              tick={{ fill: "#4a5568", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              y={capacity * 0.85}
              stroke="#ff4757"
              strokeDasharray="4 4"
              strokeOpacity={0.4}
              label={{ value: "85%", fill: "#ff4757", fontSize: 9, position: "right" }}
            />
            <Area
              type="monotone"
              dataKey="occupancy"
              stroke="#38f2b0"
              strokeWidth={2}
              fill="url(#crowdGradient)"
              animationDuration={300}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
