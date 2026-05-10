"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface GradesBucket {
  label: string;
  count: number;
}

interface GradesChartProps {
  distribution: GradesBucket[];
}

const COLORS = ["#EF4444", "#F97316", "#F59E0B", "#22C55E", "#10B981", "#0EA5E9", "#6366F1"];

interface TooltipProps {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-soraDark border border-white/10 rounded-xl p-3 shadow-2xl">
      <p className="text-gray-400 text-xs mb-1">Note {label}/20</p>
      <p className="text-white text-sm">{payload[0].value} élève(s)</p>
    </div>
  );
}

export function GradesChart({ distribution }: GradesChartProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={distribution} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 11 }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 10 }} width={28} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
          {distribution.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
