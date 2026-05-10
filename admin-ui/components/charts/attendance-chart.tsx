"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface AttendanceChartProps {
  data: { date: string; present: number; absent: number; late: number }[];
}

interface TooltipProps {
  active?: boolean;
  payload?: { value: number; name: string; color: string }[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const labels: Record<string, string> = { present: "Présents", absent: "Absents", late: "Retards" };
  return (
    <div className="bg-soraDark border border-white/10 rounded-xl p-3 shadow-2xl">
      <p className="text-gray-400 text-xs mb-2">{label}</p>
      {payload.map((e, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: e.color }} />
          <span className="text-gray-300">{labels[e.name] ?? e.name}: {e.value}</span>
        </div>
      ))}
    </div>
  );
}

export function AttendanceChart({ data }: AttendanceChartProps) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 10 }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 10 }} width={32} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: "11px", color: "#9CA3AF" }} />
        <Line type="monotone" dataKey="present" name="present" stroke="#22C55E" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="absent" name="absent" stroke="#EF4444" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="late" name="late" stroke="#F59E0B" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
