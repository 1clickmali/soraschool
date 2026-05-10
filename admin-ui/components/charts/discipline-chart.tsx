"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DisciplineChartProps {
  data: { label: string; incidents: number }[];
}

interface TooltipProps {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-soraDark border border-white/10 rounded-xl p-3 shadow-2xl">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className="text-white text-sm">{payload[0].value} incident(s)</p>
    </div>
  );
}

export function DisciplineChart({ data }: DisciplineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 11 }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 10 }} width={28} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Bar dataKey="incidents" fill="#F97316" radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}
